import React from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { AuthPage } from './pages/auth/AuthPage';
import { VerificationPendingPage } from './pages/auth/VerificationPendingPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { InviteLandingPage } from './pages/invite/InviteLandingPage';
import { OrganizerParticipantsPage } from './pages/organizer/OrganizerParticipantsPage';
import { OrganizerProfilePage } from './pages/organizer/OrganizerProfilePage';
import { OrganizerTeamsPage } from './pages/organizer/OrganizerTeamsPage';
import { OrganizerTournamentsPage } from './pages/organizer/OrganizerTournamentsPage';
import { ParticipantHomePage } from './pages/participant/ParticipantHomePage';
import { ParticipantTeamsPage } from './pages/participant/ParticipantTeamsPage';
import { ParticipantTournamentsPage } from './pages/participant/ParticipantTournamentsPage';
import { PublicViewerPage } from './pages/shared/PublicViewerPage';
import { PlaceholderPage } from './pages/shared/PlaceholderPage';
import { TeamHomePage } from './pages/team/TeamHomePage';
import { TeamParticipantsPage } from './pages/team/TeamParticipantsPage';
import { TeamTournamentsPage } from './pages/team/TeamTournamentsPage';
import { ProfilePage } from './pages/participant/ProfilePage';
import { claimMyDni, createParticipant, createTeam, getMyProfile, getMyTeams, getTeamDetail, logout, readSessionUser, removeTeamMember, rotateTeamCode, unlinkMyParticipant, updateParticipant, updateTeam } from './services/teamsApi';
import type { LinkedTeam, NavItem, NavItemId, TeamInfo, TeamParticipant, UserRole } from './types/domain';

export const App: React.FC = () => {
  const initialInviteToken = React.useMemo(() => {
    const match = window.location.pathname.match(/^\/invite\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, []);
  const [user, setUser] = React.useState(readSessionUser());
  const [showAuthPage, setShowAuthPage] = React.useState(false);
  const [inviteToken, setInviteToken] = React.useState<string | null>(initialInviteToken);
  const [inviteAuthRequired, setInviteAuthRequired] = React.useState(false);
  const [pendingInviteClaimMode, setPendingInviteClaimMode] = React.useState<'general_with_account' | 'team_claim' | null>(() => {
    const token = localStorage.getItem('liga360:pendingInviteToken');
    const mode = localStorage.getItem('liga360:pendingInviteClaimMode');
    if (!token || token !== initialInviteToken) return null;
    if (mode === 'general_with_account' || mode === 'team_claim') return mode;
    return null;
  });
  const NAV_IDS: NavItemId[] = ['inicio', 'torneos', 'equipos', 'participantes', 'perfil'];
  const [activeNav, setActiveNav] = React.useState<NavItemId>(() => {
    const seg = window.location.pathname.replace(/^\//, '').split('/')[0] as NavItemId;
    return NAV_IDS.includes(seg) ? seg : 'inicio';
  });

  function navigate(id: NavItemId) {
    setActiveNav(id);
    const path = id === 'inicio' ? '/' : `/${id}`;
    if (window.location.pathname !== path) {
      window.history.pushState({ nav: id }, '', path);
    }
  }

  React.useEffect(() => {
    function onPop(e: PopStateEvent) {
      const id = (e.state?.nav as NavItemId) || 'inicio';
      setActiveNav(NAV_IDS.includes(id) ? id : 'inicio');
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const [teams, setTeams] = React.useState<TeamInfo[]>([]);
  const [activeTeamId, setActiveTeamId] = React.useState<string | null>(null);
  const [teamParticipants, setTeamParticipants] = React.useState<TeamParticipant[]>([]);
  const [teamLoading, setTeamLoading] = React.useState(false);
  const [teamError, setTeamError] = React.useState('');

  const [profileLoading, setProfileLoading] = React.useState(false);
  const [profileError, setProfileError] = React.useState('');
  const [profileName, setProfileName] = React.useState('');
  const [profileFirstName, setProfileFirstName] = React.useState('');
  const [profileLastName, setProfileLastName] = React.useState('');
  const [profileNickname, setProfileNickname] = React.useState('');
  const [profileDni, setProfileDni] = React.useState('');
  const [profileAvatar, setProfileAvatar] = React.useState('');
  const [linkedParticipants, setLinkedParticipants] = React.useState<TeamParticipant[]>([]);
  const [linkedTeams, setLinkedTeams] = React.useState<LinkedTeam[]>([]);

  const activeTeam = React.useMemo(
    () => teams.find((team) => team.id === activeTeamId) || null,
    [teams, activeTeamId]
  );

  const currentRole: UserRole = (user?.type as UserRole) || 'participant';
  const navItems = React.useMemo<NavItem[]>(() => {
    if (currentRole === 'organizer') {
      return [
        { id: 'torneos', label: 'Torneos' },
        { id: 'equipos', label: 'Equipos' },
        { id: 'participantes', label: 'Participantes' },
      ];
    }
    if (currentRole === 'team') {
      return [
        { id: 'inicio', label: 'Inicio' },
        { id: 'participantes', label: 'Plantilla' },
        { id: 'torneos', label: 'Torneos' },
      ];
    }
    return [
      { id: 'inicio', label: 'Inicio' },
      { id: 'equipos', label: 'Equipos' },
      { id: 'torneos', label: 'Torneos' },
      { id: 'perfil', label: 'Mi Perfil' },
    ];
  }, [currentRole]);

  React.useEffect(() => {
    if (!user) return;
    if (!user.isVerified) return;
    (async () => {
      try {
        let teamList = await getMyTeams();
        if (currentRole === 'team' && teamList.length === 0) {
          // Alinea UX con el concepto "cuenta equipo": si no existe en teams-svc, se crea uno base.
          const pendingName = localStorage.getItem('liga360:pendingTeamName')?.trim();
          const created = await createTeam(pendingName || user.fullName);
          localStorage.removeItem('liga360:pendingTeamName');
          teamList = [created.team];
        }
        setTeams(teamList);
        setActiveTeamId((prev) => {
          if (teamList.length === 0) return null;
          if (prev && teamList.some((team) => team.id === prev)) return prev;
          if (currentRole === 'team') {
            const ownedTeam = teamList.find((team) => team.isOwner);
            if (ownedTeam) return ownedTeam.id;
          }
          return teamList[0].id;
        });
      } catch (err: any) {
        setTeamError(err?.message || 'No se pudieron cargar equipos');
      }
    })();
  }, [user, currentRole]);

  React.useEffect(() => {
    if (!navItems.some((item) => item.id === activeNav)) {
      navigate(navItems[0]?.id || 'inicio');
    }
  }, [activeNav, navItems]);

  React.useEffect(() => {
    if (!user || !activeTeamId) return;
    if (!user.isVerified) return;
    (async () => {
      setTeamLoading(true);
      setTeamError('');
      try {
        const detail = await getTeamDetail(activeTeamId);
        setTeams((prev) =>
          prev.map((team) => (team.id === activeTeamId ? { ...team, ...detail.team } : team))
        );
        setTeamParticipants(detail.participants);
      } catch (err: any) {
        setTeamError(err?.message || 'No se pudo cargar detalle de equipo');
      } finally {
        setTeamLoading(false);
      }
    })();
  }, [user, activeTeamId]);

  React.useEffect(() => {
    if (!user) return;
    if (!user.isVerified) return;
    if (currentRole !== 'participant' && activeNav !== 'perfil') return;
    (async () => {
      setProfileLoading(true);
      setProfileError('');
      try {
        const profile = await getMyProfile();
        const first = profile.profile?.first_name || '';
        const last = profile.profile?.last_name || '';
        setProfileName(
          `${first} ${last}`.trim() ||
            user.fullName
        );
        setProfileFirstName(first);
        setProfileLastName(last);
        setProfileNickname(profile.participants?.[0]?.nickname || '');
        setProfileDni(profile.profile?.dni || '');
        setProfileAvatar(profile.profile?.avatar_url || '');
        setLinkedParticipants(profile.participants);
        setLinkedTeams(profile.teams);
      } catch (err: any) {
        setProfileError(err?.message || 'No se pudo cargar perfil');
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [activeNav, user, currentRole]);

  function handleLogout() {
    logout();
    setUser(null);
    setShowAuthPage(false);
    setTeams([]);
    setActiveTeamId(null);
  }

  if (window.location.pathname === '/verify') {
    return <VerifyEmailPage />;
  }

  if (inviteToken) {
    if (!user && inviteAuthRequired) {
      return (
        <AuthPage
          onAuthenticated={() => {
            setUser(readSessionUser());
            setInviteAuthRequired(false);
          }}
        />
      );
    }
    return (
      <InviteLandingPage
        token={inviteToken}
        isAuthenticated={Boolean(user)}
        pendingClaimMode={pendingInviteClaimMode}
        onRequireAuth={(mode) => {
          localStorage.setItem('liga360:pendingInviteToken', inviteToken);
          localStorage.setItem('liga360:pendingInviteClaimMode', mode);
          setPendingInviteClaimMode(mode);
          setInviteAuthRequired(true);
        }}
        onConsumePendingClaim={() => {
          localStorage.removeItem('liga360:pendingInviteClaimMode');
          setPendingInviteClaimMode(null);
        }}
        onExit={() => {
          window.history.replaceState({}, '', '/');
          localStorage.removeItem('liga360:pendingInviteToken');
          localStorage.removeItem('liga360:pendingInviteClaimMode');
          setInviteToken(null);
          setPendingInviteClaimMode(null);
          setInviteAuthRequired(false);
        }}
      />
    );
  }

  if (!user) {
    if (!showAuthPage) {
      return (
        <PublicViewerPage
          onGoToAuth={() => setShowAuthPage(true)}
        />
      );
    }

    return (
      <AuthPage
        onBackToPublic={() => setShowAuthPage(false)}
        onAuthenticated={() => {
          setUser(readSessionUser());
          setShowAuthPage(false);
          const pendingInviteToken = localStorage.getItem('liga360:pendingInviteToken');
          if (pendingInviteToken) {
            window.history.replaceState({}, '', `/invite/${pendingInviteToken}`);
            setInviteToken(pendingInviteToken);
            const pendingMode = localStorage.getItem('liga360:pendingInviteClaimMode');
            if (pendingMode === 'general_with_account' || pendingMode === 'team_claim') {
              setPendingInviteClaimMode(pendingMode);
            } else {
              setPendingInviteClaimMode(null);
            }
            setInviteAuthRequired(false);
          }
        }}
      />
    );
  }

  if (user && !user.isVerified) {
    return <VerificationPendingPage onLogout={handleLogout} />;
  }

  const currentUser = user;

  async function handleCreateParticipant(payload: any) {
    if (!activeTeam) return;
    const teamCode = activeTeam.isOwner ? undefined : window.prompt('Ingresa codigo secreto del equipo') || undefined;
    await createParticipant({
      firstName: payload.firstName,
      lastName: payload.lastName,
      nickname: payload.nickname,
      dni: payload.dni,
      avatarUrl: payload.avatarUrl,
      teamId: payload.addToTeam ? activeTeam.id : undefined,
      teamCode,
    });
    const detail = await getTeamDetail(activeTeam.id);
    setTeamParticipants(detail.participants);
  }

  async function handleRemoveParticipant(participantId: string) {
    if (!activeTeam) return;
    const teamCode = activeTeam.isOwner ? undefined : window.prompt('Ingresa codigo secreto del equipo') || undefined;
    await removeTeamMember(activeTeam.id, participantId, teamCode);
    setTeamParticipants((prev) => prev.filter((participant) => participant.id !== participantId));
  }

  async function handleUpdateParticipant(participantId: string, payload: any) {
    if (!activeTeam) return;
    const teamCode = activeTeam.isOwner ? undefined : window.prompt('Ingresa codigo secreto del equipo') || undefined;
    await updateParticipant(participantId, {
      teamId: activeTeam.id,
      firstName: payload.firstName,
      lastName: payload.lastName,
      nickname: payload.nickname,
      dni: payload.dni,
      avatarUrl: payload.avatarUrl,
      teamCode,
    });
    const detail = await getTeamDetail(activeTeam.id);
    setTeamParticipants(detail.participants);
  }

  async function handleRotateCode() {
    if (!activeTeam) return;
    try {
      const newCode = await rotateTeamCode(activeTeam.id);
      setTeams((prev) => prev.map((team) => (team.id === activeTeam.id ? { ...team, secretCode: newCode } : team)));
    } catch (err: any) {
      setTeamError(err?.message || 'No se pudo rotar codigo');
    }
  }

  async function handleCopyCode() {
    if (!activeTeam?.secretCode) {
      setTeamError('Todavia no tenes un codigo visible. Rotalo para generar uno nuevo.');
      return;
    }
    try {
      await navigator.clipboard.writeText(activeTeam.secretCode);
    } catch {
      setTeamError('No se pudo copiar el codigo al portapapeles');
    }
  }

  async function handleUpdateTeamLogo(badgeUrl: string) {
    if (!activeTeam) return;
    const teamCode = activeTeam.isOwner ? undefined : window.prompt('Ingresa codigo secreto del equipo') || undefined;
    const updated = await updateTeam(activeTeam.id, {
      badgeUrl: badgeUrl.trim() || '',
      teamCode,
    });
    setTeams((prev) =>
      prev.map((team) => (
        team.id === activeTeam.id
          ? { ...team, name: updated.name, badgeUrl: updated.badge_url || null }
          : team
      ))
    );
  }

  async function handleClaimDni() {
    const dni = window.prompt('Ingresa tu DNI (7 u 8 digitos)') || '';
    if (!dni.trim()) return;
    await claimMyDni({ dni, firstName: profileName.split(' ')[0] || currentUser.fullName, lastName: profileName.split(' ').slice(1).join(' ') });
    const profile = await getMyProfile();
    setProfileDni(profile.profile?.dni || '');
    setLinkedParticipants(profile.participants);
    setLinkedTeams(profile.teams);
  }

  async function handleUnlinkParticipant(participantId: string) {
    await unlinkMyParticipant(participantId);
    setLinkedParticipants((prev) => prev.filter((participant) => participant.id !== participantId));
  }

  async function handleSaveProfile(payload: { firstName: string; lastName: string; dni: string; avatarUrl: string }) {
    const dni = payload.dni.trim();
    if (!dni) throw new Error('Para guardar el perfil, primero define un DNI valido.');
    await claimMyDni({
      dni,
      firstName: payload.firstName.trim() || profileFirstName || currentUser.fullName,
      lastName: payload.lastName.trim() || profileLastName,
      avatarUrl: payload.avatarUrl || profileAvatar,
    });
    const profile = await getMyProfile();
    const first = profile.profile?.first_name || '';
    const last = profile.profile?.last_name || '';
    setProfileName(`${first} ${last}`.trim() || currentUser.fullName);
    setProfileFirstName(first);
    setProfileLastName(last);
    setProfileNickname(profile.participants?.[0]?.nickname || '');
    setProfileDni(profile.profile?.dni || '');
    setProfileAvatar(profile.profile?.avatar_url || '');
    setLinkedParticipants(profile.participants);
    setLinkedTeams(profile.teams);
  }

  function renderPage() {
    if (currentRole === 'organizer') {
      if (activeNav === 'torneos') {
        return <OrganizerTournamentsPage organizerName={currentUser.username || currentUser.fullName} />;
      }
      if (activeNav === 'equipos') {
        return <OrganizerTeamsPage />;
      }
      if (activeNav === 'participantes') {
        return <OrganizerParticipantsPage />;
      }
      if (activeNav === 'perfil') {
        return (
          <OrganizerProfilePage
            organizationName={currentUser.fullName}
            username={currentUser.username || currentUser.fullName}
          />
        );
      }
      return <OrganizerTournamentsPage organizerName={currentUser.username || currentUser.fullName} />;
    }

    if (currentRole === 'team') {
      if (activeNav === 'inicio') {
        return (
          <TeamHomePage
            team={activeTeam}
            participants={teamParticipants}
            tournamentsCount={0}
          />
        );
      }
      if (activeNav === 'participantes') {
        return (
          <TeamParticipantsPage
            team={activeTeam}
            participants={teamParticipants}
            loading={teamLoading}
            error={teamError}
            onCreateParticipant={handleCreateParticipant}
            onUpdateParticipant={handleUpdateParticipant}
            onRemoveParticipant={handleRemoveParticipant}
            onRotateCode={handleRotateCode}
            onCopyCode={handleCopyCode}
            onUpdateTeamLogo={handleUpdateTeamLogo}
          />
        );
      }
      if (activeNav === 'torneos') {
        return <TeamTournamentsPage activeTeamId={activeTeam?.id || null} activeTeamName={activeTeam?.name || null} />;
      }
      if (activeNav === 'perfil') {
        return (
          <ProfilePage
            fullName={profileName || currentUser.fullName}
            firstName={profileFirstName || (currentUser.fullName.split(' ')[0] || '')}
            lastName={profileLastName || currentUser.fullName.split(' ').slice(1).join(' ')}
            nickname={profileNickname}
            dni={profileDni || 'Sin DNI'}
            avatarUrl={profileAvatar}
            participants={linkedParticipants}
            teams={linkedTeams}
            loading={profileLoading}
            error={profileError}
            onClaim={handleClaimDni}
            onUnlink={handleUnlinkParticipant}
            onSaveProfile={handleSaveProfile}
          />
        );
      }
      return (
        <TeamHomePage
          team={activeTeam}
          participants={teamParticipants}
          tournamentsCount={0}
        />
      );
    }

    if (activeNav === 'inicio') {
      return (
        <ParticipantHomePage
          linkedTeams={linkedTeams}
          linkedParticipants={linkedParticipants}
          teamTournamentsCount={0}
          individualTournamentsCount={0}
        />
      );
    }
    if (activeNav === 'equipos') {
      return <ParticipantTeamsPage linkedTeams={linkedTeams} />;
    }
    if (activeNav === 'torneos') {
      return <ParticipantTournamentsPage />;
    }

    if (activeNav === 'perfil') {
      return (
        <ProfilePage
          fullName={profileName || currentUser.fullName}
          firstName={profileFirstName || (currentUser.fullName.split(' ')[0] || '')}
          lastName={profileLastName || currentUser.fullName.split(' ').slice(1).join(' ')}
          nickname={profileNickname}
          dni={profileDni || 'Sin DNI'}
          avatarUrl={profileAvatar}
          participants={linkedParticipants}
          teams={linkedTeams}
          loading={profileLoading}
          error={profileError}
          onClaim={handleClaimDni}
          onUnlink={handleUnlinkParticipant}
          onSaveProfile={handleSaveProfile}
        />
      );
    }
    if (activeNav === 'participantes') {
      return (
        <PlaceholderPage
          title="Participantes"
          description="Vista lista para integrar con filtros avanzados y acciones de vinculacion."
        />
      );
    }
    return (
      <PlaceholderPage
        title="Participantes"
        description="Vista de participantes lista para integrar filtros, busqueda y acciones sobre vinculaciones."
      />
    );
  }

  return (
    <AppLayout
      user={currentUser}
      activeTeamName={activeTeam?.name || 'Sin equipo'}
      showActiveTeam={currentRole === 'team' ? Boolean(activeTeam?.name) : true}
      activeNav={activeNav}
      navItems={navItems}
      onNavigate={navigate}
      onLogout={handleLogout}
    >
      {renderPage()}
    </AppLayout>
  );
};

