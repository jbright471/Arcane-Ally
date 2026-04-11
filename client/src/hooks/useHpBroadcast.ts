import { useCallback } from 'react';
import { toast } from 'sonner';
import { useHpWriteQueue } from './useHpWriteQueue';

/**
 * useHpBroadcast — player-side hook that broadcasts an HP change to the server
 * and shows optimistic local feedback.
 *
 * Internally uses useHpWriteQueue to queue HP changes offline and drain on reconnect.
 *
 * Usage:
 *   const { broadcast } = useHpBroadcast(character.id, character.name);
 *   broadcast(-5, 'fire');   // damage
 *   broadcast(10);           // heal
 */
export function useHpBroadcast(characterId: string, characterName: string) {
  const { emitHp } = useHpWriteQueue();

  const broadcast = useCallback(
    (delta: number, damageType?: string) => {
      if (!delta) return;

      const absDelta = Math.abs(delta);
      const type = delta < 0 ? 'damage' : 'heal';

      // Optimistic toast — shown before the server roundtrip
      if (type === 'damage') {
        toast.error(`${characterName} took ${absDelta}${damageType ? ` ${damageType}` : ''} damage`);
      } else {
        toast.success(`${characterName} healed for ${absDelta} HP`);
      }

      emitHp(
        parseInt(characterId),
        delta,
        type === 'damage' ? (damageType || 'untyped') : null,
        characterName,
      );
    },
    [characterId, characterName, emitHp],
  );

  return { broadcast };
}
