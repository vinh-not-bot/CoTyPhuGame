export interface Player {
  userId: string;
  name: string;
  avatarColor: string;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  doubleRollCount: number;
  jailFreeCards?: number;
  characterId?: string;
}

export interface Tile {
  index: number;
  name: string;
  type: 'go' | 'property' | 'chance' | 'communitychest' | 'tax' | 'railroad' | 'utility' | 'jail' | 'gotojail' | 'freeparking';
  colorGroup: 'brown' | 'sky' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'navy' | null;
  price: number;
  ownerId: string | null;
  houses: number; // 0-4, 5 is Hotel
  mortgaged: boolean;
  housePrice: number;
  rent: number[];
}

export interface GameState {
  room_id: string;
  current_turn_index: number;
  turn_phase: 'roll' | 'resolve' | 'action' | 'end';
  players: Player[];
  board: Tile[];
  chance_deck: any[];
  community_deck: any[];
  last_dice: [number, number];
  log: { time: string; text: string }[];
  winner_id: string | null;
  updated_at: string;
}

export interface Room {
  id: string;
  room_code: string;
  host_id: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  is_public: boolean;
  settings: {
    startMoney: number;
    maxPlayers: number;
    freeParkingJackpot: boolean;
  };
}

export interface Trade {
  id: string;
  room_id: string;
  proposer_id: string;
  receiver_id: string;
  proposer_cash: number;
  proposer_properties: number[];
  receiver_cash: number;
  receiver_properties: number[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}
