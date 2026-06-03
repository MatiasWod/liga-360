import React from 'react';
import { TOURNAMENT_PRESETS } from '../presets';
import type { TournamentPreset, PresetParam } from '../presets';
import type { CompetitionMeta } from './CompetitionsBuilder';
import type { PresetCategory } from '../presets';

interface QuickSetupModalProps {
    open: boolean;
    onClose: () => void;
    onApply: (competitions: CompetitionMeta[]) => void;
    draftStorageKey: string;
}

type ActivePanel = 'general' | 'own';

export const QuickSetupModal: React.FC<QuickSetupModalProps> = ({ open, onClose, onApply, draftStorageKey }) => {
    const [pendingPreset, setPendingPreset] = React.useState<TournamentPreset | null>(null);
    const [pendingParams, setPendingParams] = React.useState<Record<string, number>>({});
    const [activePanel, setActivePanel] = React.useState<ActivePanel>('general');

    if (!open) return null;

    const hasDraft = (() => {
        try {
            const raw = localStorage.getItem(draftStorageKey);
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return Boolean(parsed?.competitions?.length);
        } catch {
            return false;
        }
    })();

    function handleApply(preset: TournamentPreset, params: Record<string, number>) {
        if (hasDraft) {
            setPendingPreset(preset);
            setPendingParams(params);
        } else {
            onApply(preset.createCompetitions(params));
        }
    }

    function confirmReplace() {
        if (!pendingPreset) return;
        onApply(pendingPreset.createCompetitions(pendingParams));
        setPendingPreset(null);
        setPendingParams({});
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-xl border border-border-subtle bg-surface-1 text-text-primary shadow-2xl shadow-black/40">
                <header className="border-b border-border-subtle px-6 pt-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary">Creación rápida</h3>
                            <p className="text-sm text-text-muted mt-0.5">Elegí una plantilla para pre-configurar la estructura del torneo</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
                            aria-label="Cerrar"
                        >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex gap-1">
                        {(['general', 'own'] as ActivePanel[]).map((panel) => (
                            <button
                                key={panel}
                                type="button"
                                onClick={() => setActivePanel(panel)}
                                className={[
                                    'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                                    activePanel === panel
                                        ? 'border-accent-primary text-accent-primary'
                                        : 'border-transparent text-text-muted hover:text-text-primary',
                                ].join(' ')}
                            >
                                {panel === 'general' ? 'Presets generales' : 'Mis presets'}
                            </button>
                        ))}
                    </div>
                </header>

                {pendingPreset ? (
                    <div className="p-6 space-y-4">
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                            Tenés un borrador guardado. Usar esta plantilla lo reemplazará.
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setPendingPreset(null); setPendingParams({}); }}
                                className="rounded-xl border border-border-subtle bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-2"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmReplace}
                                className="rounded-xl bg-accent-primary px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
                            >
                                Reemplazar borrador y usar plantilla
                            </button>
                        </div>
                    </div>
                ) : activePanel === 'general' ? (
                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                        {TOURNAMENT_PRESETS.map((cat: PresetCategory) => (
                            <div key={cat.category}>
                                <h4 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">{cat.category}</h4>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {cat.presets.map((preset) => (
                                        <PresetCard key={preset.id} preset={preset} onApply={handleApply} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-text-primary">Todavía no tenés presets guardados</p>
                        <p className="text-xs text-text-muted max-w-xs">Próximamente podrás guardar tus configuraciones favoritas para reutilizarlas</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface PresetCardProps {
    preset: TournamentPreset;
    onApply: (preset: TournamentPreset, params: Record<string, number>) => void;
}

const PresetCard: React.FC<PresetCardProps> = ({ preset, onApply }) => {
    const [params, setParams] = React.useState<Record<string, number>>(() =>
        Object.fromEntries((preset.params ?? []).map((p) => [p.key, p.default]))
    );

    function setParam(key: string, value: number) {
        setParams((prev) => ({ ...prev, [key]: value }));
    }

    return (
        <div className="flex flex-col rounded-xl border border-border-subtle bg-surface-2 p-5 gap-3">
            <div>
                <h4 className="font-semibold text-text-primary text-base">{preset.title}</h4>
                <p className="text-xs text-text-muted mt-0.5">{preset.subtitle}</p>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{preset.description}</p>
            <ul className="space-y-1">
                {preset.stages.map((s, i) => (
                    <li key={i} className="flex gap-2 text-xs text-text-muted">
                        <span className="mt-0.5 shrink-0 h-4 w-4 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center font-bold text-[10px]">{i + 1}</span>
                        <span><span className="font-medium text-text-secondary">{s.name}</span> — {s.description}</span>
                    </li>
                ))}
            </ul>
            {(preset.params ?? []).length > 0 && (
                <div className="rounded-lg border border-border-subtle bg-surface-1 p-3 space-y-2.5">
                    {(preset.params ?? []).map((param) => (
                        <ParamControl key={param.key} param={param} value={params[param.key] ?? param.default} onChange={(v) => setParam(param.key, v)} />
                    ))}
                </div>
            )}
            {preset.warning && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    ⚠ {preset.warning}
                </div>
            )}
            <button
                type="button"
                onClick={() => onApply(preset, params)}
                className="mt-auto rounded-xl bg-accent-primary px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
            >
                Crear a partir de
            </button>
        </div>
    );
};

const ParamControl: React.FC<{ param: PresetParam; value: number; onChange: (v: number) => void }> = ({ param, value, onChange }) => (
    <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-secondary shrink-0">{param.label}</span>
        <div className="flex gap-1 flex-wrap justify-end">
            {param.options.map((opt: number) => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={[
                        'px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors',
                        value === opt
                            ? 'bg-accent-primary text-white'
                            : 'bg-surface-2 text-text-muted border border-border-subtle hover:border-border-strong hover:text-text-primary',
                    ].join(' ')}
                >
                    {opt}
                </button>
            ))}
        </div>
    </div>
);
