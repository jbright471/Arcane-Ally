import { Character } from '../types/character';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Sparkles } from 'lucide-react';
import socket from '../socket';

interface FeaturesPanelProps {
  character: Character;
}

/**
 * Renders the character's features and allows toggling active features.
 */
export function FeaturesPanel({ character }: FeaturesPanelProps) {

  const toggleFeature = (featureName: string) => {
    socket.emit('toggle_feature', {
      characterId: character.id,
      featureName,
      actor: character.name,
      requestId: crypto.randomUUID()
    });
  };

  const activeFeatures = character.activeFeatures || [];
  const features = character.features || character.abilities || [];

  if (features.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-display flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-mana" />
          Features & Traits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {features.map((feature, idx) => {
          const isActive = activeFeatures.includes(feature.name);
          return (
            <div 
              key={idx} 
              className={`flex items-center justify-between p-3 rounded border transition-colors cursor-pointer select-none ${isActive ? 'bg-primary/20 border-primary/50' : 'bg-secondary/30 border-border/50 hover:bg-secondary/50'}`}
              onClick={() => toggleFeature(feature.name)}
            >
              <div className="flex flex-col">
                <span className={`font-display text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>{feature.name}</span>
                <span className="text-[10px] text-muted-foreground line-clamp-2">
                  {feature.description || feature.source}
                </span>
              </div>
              <div className={`shrink-0 w-4 h-4 rounded-sm border flex items-center justify-center ml-4 ${isActive ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/50'}`}>
                {isActive && <span className="text-[10px] leading-none mb-0.5">✓</span>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
