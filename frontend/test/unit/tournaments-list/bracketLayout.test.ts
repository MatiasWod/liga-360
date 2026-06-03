import { describe, expect, it } from 'vitest';
import {
	bracketCenterY,
	bracketMatchSlotHeight,
	bracketSlotsPerSide,
	bracketTreeContentHeight,
	bracketVisualSlotIndex,
} from '../../../modules/tournaments-list/bracketLayout';

describe('bracketLayout', () => {
	it('espeja slots de la mitad derecha para alinear con la izquierda', () => {
		const maxSlot = 8;
		expect(bracketVisualSlotIndex(1, maxSlot)).toBe(1);
		expect(bracketVisualSlotIndex(4, maxSlot)).toBe(4);
		expect(bracketVisualSlotIndex(5, maxSlot)).toBe(4);
		expect(bracketVisualSlotIndex(8, maxSlot)).toBe(1);
	});

	it('alinea centros verticales de llaves simétricas en octavos', () => {
		const baseH = 68;
		const leftTop = bracketCenterY(0, bracketVisualSlotIndex(1, 8), baseH);
		const rightTop = bracketCenterY(0, bracketVisualSlotIndex(8, 8), baseH);
		expect(rightTop).toBe(leftTop);

		const leftBottom = bracketCenterY(0, bracketVisualSlotIndex(4, 8), baseH);
		const rightBottom = bracketCenterY(0, bracketVisualSlotIndex(5, 8), baseH);
		expect(rightBottom).toBe(leftBottom);
	});

	it('calcula altura por mitad en la primera ronda', () => {
		expect(bracketSlotsPerSide(8)).toBe(4);
		expect(bracketSlotsPerSide(4)).toBe(2);
	});

	it('bracketTreeContentHeight ajusta al contenido real sin padding extra', () => {
		const labelH = 24;
		const cardHalfH = 26;
		const slotH = bracketMatchSlotHeight(1);
		const centerY = bracketCenterY(0, 4, 68);
		const top = Math.max(labelH, labelH + centerY - cardHalfH);
		const expected = top + slotH;
		expect(
			bracketTreeContentHeight([{ centerY, legCount: 1 }], labelH, cardHalfH),
		).toBe(expected);
	});
});
