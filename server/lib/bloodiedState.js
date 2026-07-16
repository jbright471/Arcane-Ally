'use strict';

function isBloodied(currentHp, maxHp, rules) {
  if (!rules?.bloodiedDetection || Number(maxHp) <= 0 || Number(currentHp) <= 0) return false;
  const threshold = Math.min(99, Math.max(1, Number(rules.bloodiedThresholdPercent) || 50));
  return (Number(currentHp) / Number(maxHp)) * 100 <= threshold;
}

function getBloodiedTransition(previousHp, currentHp, maxHp, rules) {
  if (!rules?.bloodiedDetection) return null;
  if (Number(currentHp) <= 0) return null;
  const wasBloodied = isBloodied(previousHp, maxHp, rules);
  const nowBloodied = isBloodied(currentHp, maxHp, rules);
  if (wasBloodied === nowBloodied) return null;
  return nowBloodied ? 'entered' : 'exited';
}

module.exports = { isBloodied, getBloodiedTransition };
