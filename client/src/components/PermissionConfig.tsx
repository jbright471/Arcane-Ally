import { Shield, Swords, Package, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useGame, ResourcePermissions } from '../context/GameContext';
import socket from '../socket';

// ─── Permission definitions ───────────────────────────────────────────────────

type PermValue = 'open' | 'dm_approval' | 'owner_only' | 'dm_only';

interface PermDef {
  key: keyof ResourcePermissions;
  label: string;
  desc: string;
  options: PermValue[];
}

interface PermGroup {
  label: string;
  icon: React.ElementType;
  permissions: PermDef[];
}

const PERMISSION_GROUPS: PermGroup[] = [
  {
    label: 'Combat',
    icon: Swords,
    permissions: [
      {
        key: 'cross_player_effects',
        label: 'Apply Effects to Others',
        desc: 'Cast heals, damage, or conditions on another player\'s character',
        options: ['open', 'dm_approval'],
      },
      {
        key: 'condition_self_apply',
        label: 'Self-Apply Conditions',
        desc: 'Players can toggle conditions on their own character',
        options: ['open', 'dm_approval'],
      },
      {
        key: 'view_monster_hp',
        label: 'Monster HP Visibility',
        desc: 'Players can see exact HP numbers on enemy tokens',
        options: ['open', 'dm_only'],
      },
    ],
  },
  {
    label: 'Loot & Items',
    icon: Package,
    permissions: [
      {
        key: 'loot_claim',
        label: 'Loot Claims',
        desc: 'Who can take items from the shared loot pool',
        options: ['open', 'dm_approval', 'owner_only'],
      },
      {
        key: 'inventory_transfer',
        label: 'Item Transfer',
        desc: 'Transfer items between characters without DM involvement',
        options: ['open', 'dm_approval'],
      },
    ],
  },
  {
    label: 'World',
    icon: Globe,
    permissions: [
      {
        key: 'edit_party_notes',
        label: 'Party Notes',
        desc: 'Who can add or edit shared party notes',
        options: ['open', 'dm_only'],
      },
    ],
  },
];

// ─── Column config (fixed 3-column matrix) ───────────────────────────────────

const COLUMNS: { value: PermValue; label: string; shortLabel: string; color: string }[] = [
  { value: 'open',       label: 'Open',       shortLabel: 'Open',     color: 'text-green-400 border-green-600/40 bg-green-950/30' },
  { value: 'dm_approval',label: 'Approval',   shortLabel: 'Approval', color: 'text-amber-400 border-amber-600/40 bg-amber-950/30' },
  { value: 'dm_only',    label: 'DM Only',    shortLabel: 'DM Only',  color: 'text-red-400 border-red-600/40 bg-red-950/30' },
  { value: 'owner_only', label: 'Owner Only', shortLabel: 'Owner',    color: 'text-violet-400 border-violet-600/40 bg-violet-950/30' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PermissionConfig() {
  const { state } = useGame();
  const { permissions } = state;

  const handleChange = (key: keyof ResourcePermissions, value: PermValue) => {
    socket.emit('update_permissions', { permissions: { ...permissions, [key]: value } });
  };

  return (
    <Card className="border-primary/20 bg-secondary/5">
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-primary" />
          Access Control
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {/* Column header */}
        <div className="grid grid-cols-[1fr_repeat(3,_auto)] gap-x-1 items-center pl-1 pr-0.5">
          <div /> {/* spacer for label column */}
          {COLUMNS.slice(0, 3).map(col => (
            <div key={col.value} className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/50 text-center w-16">
              {col.shortLabel}
            </div>
          ))}
        </div>

        {/* Permission groups */}
        {PERMISSION_GROUPS.map(group => {
          const GroupIcon = group.icon;
          return (
            <div key={group.label} className="space-y-0.5">
              {/* Group header */}
              <div className="flex items-center gap-1.5 pb-1 border-b border-primary/10 mb-2">
                <GroupIcon className="h-3 w-3 text-primary/50" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-primary/50">
                  {group.label}
                </span>
              </div>

              {/* Permission rows */}
              {group.permissions.map(perm => {
                const currentValue = permissions[perm.key] as PermValue;
                return (
                  <div
                    key={perm.key}
                    className="grid grid-cols-[1fr_repeat(3,_auto)] gap-x-1 items-center py-1 px-1 rounded hover:bg-secondary/10 transition-colors group"
                  >
                    {/* Label + description */}
                    <div className="min-w-0 pr-2">
                      <div className="text-[10px] font-semibold text-foreground/80 leading-tight">
                        {perm.label}
                      </div>
                      <div className="text-[9px] text-muted-foreground/40 leading-tight mt-0.5 hidden group-hover:block">
                        {perm.desc}
                      </div>
                    </div>

                    {/* 3 fixed cells: Open | Approval | DM Only / Owner */}
                    {(['open', 'dm_approval', 'dm_only'] as const).map((colVal, colIdx) => {
                      // Last column: for loot_claim substitute owner_only
                      const effectiveVal: PermValue = (colIdx === 2 && perm.options.includes('owner_only'))
                        ? 'owner_only'
                        : colVal;
                      const col = COLUMNS.find(c => c.value === effectiveVal)!;
                      const isAvailable = perm.options.includes(effectiveVal);
                      const isActive = currentValue === effectiveVal;

                      if (!isAvailable) {
                        return (
                          <div key={colVal} className="w-16 h-6 flex items-center justify-center">
                            <span className="text-[8px] text-muted-foreground/15">—</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={colVal}
                          onClick={() => handleChange(perm.key, effectiveVal)}
                          title={col.label}
                          className={`w-16 h-6 rounded border text-[8px] font-semibold transition-all ${
                            isActive
                              ? `${col.color} ring-1 ring-current`
                              : 'border-border/20 text-muted-foreground/30 hover:border-border/50 hover:text-muted-foreground/60 bg-transparent'
                          }`}
                        >
                          {isActive ? col.shortLabel : '·'}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        <p className="text-[9px] text-muted-foreground/40 italic pt-1">
          DM actions always bypass all restrictions.
        </p>
      </CardContent>
    </Card>
  );
}
