import type { SlotKey } from './convergingBracketLayout';
import type { ConvergingLayoutEntry } from './convergingBracketLayout';

export type BracketNodeRect = {
	key: SlotKey;
	col: number;
	centerY: number;
	cardW: number;
	colGap: number;
};

type Point = { x: number; y: number };

function nodeAnchor(
	node: BracketNodeRect,
	labelH: number,
	side: 'left' | 'right',
): Point {
	const left = node.col * (node.cardW + node.colGap);
	return {
		x: side === 'left' ? left : left + node.cardW,
		y: labelH + node.centerY,
	};
}

function mergeSameSidePath(
	fromX: number,
	toX: number,
	topY: number,
	bottomY: number,
	childY: number,
): string {
	const stubX = fromX + (toX - fromX) * 0.5;
	const midY = (topY + bottomY) / 2;
	const parts = [
		`M ${fromX} ${topY} H ${stubX}`,
		`M ${fromX} ${bottomY} H ${stubX}`,
		`M ${stubX} ${topY} V ${bottomY}`,
		`M ${stubX} ${midY} H ${toX}`,
	];
	if (Math.abs(childY - midY) > 1) {
		parts.push(`M ${toX} ${midY} V ${childY}`);
	}
	return parts.join(' ');
}

function singleFeederPath(from: Point, to: Point, fromSide: 'left' | 'right'): string {
	const stubX = fromSide === 'right'
		? from.x + (to.x - from.x) * 0.5
		: from.x - (from.x - to.x) * 0.5;
	return `M ${from.x} ${from.y} H ${stubX} V ${to.y} H ${to.x}`;
}

function crossSidePath(
	leftFrom: Point,
	rightFrom: Point,
	childLeft: number,
	childRight: number,
	childY: number,
): string {
	const jLeft = leftFrom.x + (childLeft - leftFrom.x) * 0.55;
	const jRight = rightFrom.x - (rightFrom.x - childRight) * 0.55;
	return [
		`M ${leftFrom.x} ${leftFrom.y} H ${jLeft} V ${childY} H ${childLeft}`,
		`M ${rightFrom.x} ${rightFrom.y} H ${jRight} V ${childY} H ${childRight}`,
	].join(' ');
}

export function buildConvergingConnectorPaths(input: {
	entries: ConvergingLayoutEntry[];
	feederGraph: Map<SlotKey, SlotKey[]>;
	entryBySlot: Map<SlotKey, ConvergingLayoutEntry>;
	labelH: number;
	cardW: number;
	colGap: number;
}): string[] {
	const { entries, feederGraph, entryBySlot, labelH, cardW, colGap } = input;
	const colStep = cardW + colGap;
	const paths: string[] = [];

	const rect = (e: ConvergingLayoutEntry): BracketNodeRect => ({
		key: '' as SlotKey,
		col: e.col,
		centerY: e.centerY,
		cardW,
		colGap,
	});

	for (const childEntry of entries) {
		const childKey = `${childEntry.roundNum}-${childEntry.slotIdx}` as SlotKey;
		const feederKeys = feederGraph.get(childKey);
		if (!feederKeys?.length) continue;

		const child = rect(childEntry);
		const childY = labelH + child.centerY;
		const childLeft = child.col * colStep;
		const childRight = childLeft + cardW;

		const feeders = feederKeys
			.map((fk) => {
				const e = entryBySlot.get(fk);
				return e ? { key: fk, entry: e } : null;
			})
			.filter(Boolean) as Array<{ key: SlotKey; entry: ConvergingLayoutEntry }>;

		if (feeders.length === 0) continue;

		if (feeders.length === 1) {
			const f = rect(feeders[0].entry);
			const fCol = f.col;
			const fromSide = fCol < child.col ? 'right' : 'left';
			const from = nodeAnchor(f, labelH, fromSide);
			const to = nodeAnchor(
				child,
				labelH,
				fromSide === 'right' ? 'left' : 'right',
			);
			paths.push(singleFeederPath(from, to, fromSide));
			continue;
		}

		if (feeders.length === 2) {
			const [a, b] = feeders.sort(
				(p, q) => p.entry.centerY - q.entry.centerY,
			);
			const ra = rect(a.entry);
			const rb = rect(b.entry);
			const aLeft = ra.col < child.col;
			const bLeft = rb.col < child.col;

			if (aLeft === bLeft) {
				const fromSide = aLeft ? 'right' : 'left';
				const fromX = nodeAnchor(ra, labelH, fromSide).x;
				const toX = nodeAnchor(child, labelH, fromSide === 'right' ? 'left' : 'right').x;
				const yTop = labelH + a.entry.centerY;
				const yBot = labelH + b.entry.centerY;
				paths.push(mergeSameSidePath(fromX, toX, yTop, yBot, childY));
			} else {
				const leftFeeder = aLeft ? ra : rb;
				const rightFeeder = aLeft ? rb : ra;
				const leftFrom = nodeAnchor(leftFeeder, labelH, 'right');
				const rightFrom = nodeAnchor(rightFeeder, labelH, 'left');
				paths.push(
					crossSidePath(leftFrom, rightFrom, childLeft, childRight, childY),
				);
			}
			continue;
		}

		for (const f of feeders) {
			const fr = rect(f.entry);
			const fromSide = fr.col < child.col ? 'right' : 'left';
			const from = nodeAnchor(fr, labelH, fromSide);
			const to = nodeAnchor(
				child,
				labelH,
				fromSide === 'right' ? 'left' : 'right',
			);
			paths.push(singleFeederPath(from, to, fromSide));
		}
	}

	return paths;
}
