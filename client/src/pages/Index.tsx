import { useGame } from '../context/GameContext';
import { CharacterCard } from '../components/CharacterCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { BrandMark } from '../components/BrandMark';
import { FeatureIcon, type FeatureIconTone } from '../components/FeatureIcon';
import { UserPlus, Users, Package, Scroll, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type QuickAction = {
  icon: LucideIcon;
  tone: FeatureIconTone;
  label: string;
  desc: string;
  route: string;
};

const quickActions: QuickAction[] = [
  { icon: UserPlus, tone: 'gold', label: 'New Character', desc: 'Build a hero from scratch', route: '/character/new' },
  { icon: Users, tone: 'health', label: 'Party Lobby', desc: 'View and manage the party', route: '/party' },
  { icon: Package, tone: 'mana', label: 'Equipment', desc: 'Gear, weapons & magic items', route: '/equipment' },
  { icon: Sparkles, tone: 'gold', label: 'Compendium', desc: 'Spells, rules & references', route: '/compendium' },
];

const Index = () => {
  const { state } = useGame();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="relative text-center space-y-4 py-10 px-6 rounded-xl overflow-hidden border border-primary/10 bg-gradient-to-b from-card/80 to-background/0 animate-fade-in">
        {/* Decorative background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,hsl(45_80%_55%/0.06),transparent_70%)] pointer-events-none" />
        <div className="relative flex justify-center">
          <BrandMark size="lg" className="rounded-full border-primary/30 bg-primary/5 shadow-primary/10" />
        </div>
        <div className="relative space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-wider text-foreground">
            Arcane Ally
          </h1>
          <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Real-time party sync for D&amp;D 5e. Track HP, spells, conditions, and combat — all at the table.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map(({ icon, tone, label, desc, route }) => (
          <Link
            key={label}
            to={route}
            className="group relative block overflow-hidden rounded-lg border border-border/80 bg-card/85 text-card-foreground shadow-sm transition-[transform,border-color,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 focus-visible:border-primary/60"
          >
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <CardContent className="relative p-6 text-center space-y-3">
              <div className="flex justify-center">
                <FeatureIcon icon={icon} tone={tone} />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-sm tracking-wider">{label}</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
              </div>
            </CardContent>
          </Link>
        ))}
      </div>

      {/* Characters */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-display tracking-wider flex items-center gap-2">
            <FeatureIcon icon={Scroll} tone="gold" size="heading" />
            Your Characters
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link to="/character/new">
              <UserPlus className="h-4 w-4 mr-1" /> Create
            </Link>
          </Button>
        </div>

        {state.characters.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-lg mb-2">No characters yet</p>
              <p className="text-sm">Create your first character to begin your adventure.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.characters.map(c => (
              <CharacterCard key={c.id} character={c} />
            ))}
          </div>
        )}
      </div>

      {/* Party Status */}
      {state.party && (
        <div>
          <h2 className="text-2xl font-display tracking-wider flex items-center gap-2 mb-4">
            <FeatureIcon icon={Users} tone="health" size="heading" />
            Active Party — {state.party.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.party.members.map(m => (
              <CharacterCard key={m.id} character={m} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
