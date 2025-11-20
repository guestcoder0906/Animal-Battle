
import React from 'react';
import { CardDef, CardType, CreatureType, Habitat } from '../types';
import { CARDS } from '../constants';

interface CardProps {
  defId: string;
  instanceId?: string;
  charges?: number;
  onClick?: () => void;
  isPlayable?: boolean;
  isSelected?: boolean;
  isSmall?: boolean; // For board view
  noHover?: boolean; // For overlay view
}

const TypeColors: Record<CardType, string> = {
  [CardType.Physical]: 'bg-gradient-to-br from-red-900 to-red-950 border-red-500',
  [CardType.Ability]: 'bg-gradient-to-br from-blue-900 to-blue-950 border-blue-500',
  [CardType.Size]: 'bg-gradient-to-br from-green-900 to-green-950 border-green-500',
  [CardType.Special]: 'bg-gradient-to-br from-fuchsia-900 to-purple-950 border-fuchsia-500',
};

const CreatureIcons: Record<string, string> = {
  [CreatureType.Mammal]: '🐻',
  [CreatureType.Reptile]: '🦎',
  [CreatureType.Avian]: '🦅',
  [CreatureType.Amphibian]: '🐸',
  'All': '🌍'
};

export const Card: React.FC<CardProps> = ({ defId, charges, onClick, isPlayable, isSelected, isSmall, noHover }) => {
  const def = CARDS[defId];
  if (!def) return <div className="w-20 h-32 bg-gray-800">Unknown</div>;

  const baseClasses = `relative transition-all duration-300 select-none border-2 rounded-lg flex flex-col shadow-lg ${TypeColors[def.type]} text-white overflow-hidden`;
  
  let sizeClasses = '';
  if (isSmall) {
    sizeClasses = 'w-20 h-28 md:w-24 md:h-32 text-[10px]';
  } else {
    // Standard size (Hand) or Overlay size
    // Responsive width/height for hand cards
    sizeClasses = 'w-32 h-48 md:w-40 md:h-56 text-[10px] md:text-xs z-10 shrink-0';
    if (!noHover) {
       sizeClasses += ' hover:scale-105 hover:shadow-xl hover:z-20';
    }
  }

  const stateClasses = isSelected ? 'ring-4 ring-yellow-400 translate-y-[-10px] shadow-[0_0_20px_rgba(250,204,21,0.6)]' : isPlayable ? 'hover:border-white cursor-pointer' : 'opacity-100';
  const animationClass = isSmall ? 'animate-fade-in-up' : '';

  const renderCreatureTypes = () => {
    if (def.creatureTypes === 'All') return <span>🌍 All</span>;
    return (
      <div className="flex flex-wrap gap-0.5 max-w-[70px]">
        {def.creatureTypes.map(t => (
          <span key={t} title={t}>{CreatureIcons[t]}</span>
        ))}
      </div>
    );
  };

  return (
    <div 
      className={`${baseClasses} ${sizeClasses} ${stateClasses} ${animationClass}`} 
      onClick={onClick}
    >
      <div className="bg-black/40 p-1 font-bold truncate text-center border-b border-white/20 text-shadow-sm">
        {def.name}
      </div>
      
      <div className="flex-1 p-2 flex flex-col gap-1 relative">
        {!isSmall && (
          <>
            <div className="flex justify-between items-start opacity-80 text-[10px] font-mono">
              {renderCreatureTypes()}
              <span className={def.staminaCost > 0 ? "text-yellow-300 font-bold whitespace-nowrap" : "whitespace-nowrap"}>{def.staminaCost > 0 ? `⚡${def.staminaCost}` : '0 St'}</span>
            </div>
            <div className="mt-1 opacity-90 leading-tight text-[10px] overflow-y-auto scrollbar-hide">
              {def.description}
            </div>
          </>
        )}
        {isSmall && (
           <div className="flex flex-col justify-center items-center h-full text-center">
             {def.staminaCost > 0 && <span className="text-yellow-400 font-bold text-lg block drop-shadow-md">⚡{def.staminaCost}</span>}
             <div className="text-2xl opacity-40 mt-1">
                {def.type === CardType.Physical ? '⚔️' : def.type === CardType.Ability ? '✨' : def.type === CardType.Special ? '🧬' : '📏'}
             </div>
           </div>
        )}

        {/* Charges Display */}
        {charges !== undefined && (
            <div className={`absolute bottom-0 left-0 right-0 text-center font-bold py-1 ${isSmall ? 'text-[9px]' : 'text-[10px]'} bg-black/80 text-cyan-300 border-t border-cyan-900`}>
                Uses: {charges}
            </div>
        )}
      </div>

      {def.isUpgrade && <div className="absolute top-0 right-0 bg-yellow-500 text-black px-1 text-[8px] font-bold shadow-sm">UPG</div>}
    </div>
  );
};
