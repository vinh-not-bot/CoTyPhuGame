import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { GameState, Room, Trade } from '../types';

export const getUserId = (): string => {
  let uid = localStorage.getItem('cotyphu_user_id');
  // Regex kiểm tra xem UUID có đúng định dạng chuẩn hay không (8-4-4-4-12 ký tự hex)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uid || !uuidRegex.test(uid)) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      uid = crypto.randomUUID();
    } else {
      // Fallback sinh mã UUID v4 nếu trình duyệt cũ không hỗ trợ
      uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    localStorage.setItem('cotyphu_user_id', uid);
  }
  return uid;
};

export const getUserName = (): string => {
  let name = localStorage.getItem('cotyphu_user_name');
  if (!name) {
    name = `Người chơi ${Math.floor(100 + Math.random() * 900)}`;
    localStorage.setItem('cotyphu_user_name', name);
  }
  return name;
};

export const getUserAvatarColor = (): string => {
  let color = localStorage.getItem('cotyphu_user_avatar');
  if (!color) {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    color = colors[Math.floor(Math.random() * colors.length)];
    localStorage.setItem('cotyphu_user_avatar', color);
  }
  return color;
};

interface GameStore {
  userId: string;
  userName: string;
  userAvatarColor: string;
  room: Room | null;
  players: { userId: string; display_name: string; avatar_color: string; turn_order: number; is_host: boolean }[];
  gameState: GameState | null;
  trades: Trade[];
  error: string | null;
  loading: boolean;
  
  setUserName: (name: string) => void;
  setUserAvatarColor: (color: string) => void;
  setError: (err: string | null) => void;
  
  createRoom: (maxPlayers: number, startMoney: number) => Promise<void>;
  joinRoom: (roomCode: string) => Promise<void>;
  startGame: () => Promise<void>;
  rollDice: () => Promise<void>;
  buyProperty: (tileIndex: number) => Promise<void>;
  skipBuy: () => Promise<void>;
  payRent: () => Promise<void>;
  payTax: () => Promise<void>;
  buildHouse: (tileIndex: number) => Promise<void>;
  sellHouse: (tileIndex: number) => Promise<void>;
  mortgageProperty: (tileIndex: number) => Promise<void>;
  drawCard: (deckType: 'chance' | 'communitychest') => Promise<void>;
  payJailFine: () => Promise<void>;
  useJailFreeCard: () => Promise<void>;
  proposeTrade: (
    receiverId: string,
    proposerCash: number,
    proposerProps: number[],
    receiverCash: number,
    receiverProps: number[]
  ) => Promise<string | null>;
  acceptTrade: (tradeId: string) => Promise<void>;
  rejectTrade: (tradeId: string) => Promise<void>;
  declareBankruptcy: () => Promise<void>;
  endTurn: () => Promise<void>;
  
  fetchRoomData: (roomId: string) => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  userId: getUserId(),
  userName: getUserName(),
  userAvatarColor: getUserAvatarColor(),
  room: null,
  players: [],
  gameState: null,
  trades: [],
  error: null,
  loading: false,

  setUserName: (name: string) => {
    localStorage.setItem('cotyphu_user_name', name);
    set({ userName: name });
  },

  setUserAvatarColor: (color: string) => {
    localStorage.setItem('cotyphu_user_avatar', color);
    set({ userAvatarColor: color });
  },

  setError: (err: string | null) => set({ error: err }),

  createRoom: async (maxPlayers: number, startMoney: number) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('create_room', {
        p_host_user_id: get().userId,
        p_host_name: get().userName,
        p_settings: { maxPlayers, startMoney, freeParkingJackpot: false }
      });

      if (error) throw error;
      if (data && data.length > 0) {
        const { room_id } = data[0];
        await get().fetchRoomData(room_id);
      }
    } catch (err: any) {
      set({ error: err.message || 'Lỗi khi tạo phòng' });
    } finally {
      set({ loading: false });
    }
  },

  joinRoom: async (roomCode: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('join_room', {
        p_room_code: roomCode.trim().toUpperCase(),
        p_user_id: get().userId,
        p_display_name: get().userName,
        p_avatar_color: get().userAvatarColor
      });

      if (error) throw error;
      if (data) {
        await get().fetchRoomData(data);
      }
    } catch (err: any) {
      set({ error: err.message || 'Lỗi khi vào phòng' });
    } finally {
      set({ loading: false });
    }
  },

  startGame: async () => {
    const { room } = get();
    if (!room) return;
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.rpc('start_game', {
        p_room_id: room.id
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message || 'Lỗi khi bắt đầu game' });
    } finally {
      set({ loading: false });
    }
  },

  rollDice: async () => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('roll_dice', {
        p_room_id: room.id,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  buyProperty: async (tileIndex: number) => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('buy_property', {
        p_room_id: room.id,
        p_user_id: get().userId,
        p_tile_index: tileIndex
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  skipBuy: async () => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('skip_buy', {
        p_room_id: room.id,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  payRent: async () => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('pay_rent', {
        p_room_id: room.id,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  payTax: async () => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('pay_tax', {
        p_room_id: room.id,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  buildHouse: async (tileIndex: number) => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('build_house', {
        p_room_id: room.id,
        p_user_id: get().userId,
        p_tile_index: tileIndex
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  sellHouse: async (tileIndex: number) => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('sell_house', {
        p_room_id: room.id,
        p_user_id: get().userId,
        p_tile_index: tileIndex
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  mortgageProperty: async (tileIndex: number) => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('mortgage_property', {
        p_room_id: room.id,
        p_user_id: get().userId,
        p_tile_index: tileIndex
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  drawCard: async (deckType: 'chance' | 'communitychest') => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('draw_card', {
        p_room_id: room.id,
        p_user_id: get().userId,
        p_deck_type: deckType
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  payJailFine: async () => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('pay_jail_fine', {
        p_room_id: room.id,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  useJailFreeCard: async () => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('use_jail_free_card', {
        p_room_id: room.id,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  proposeTrade: async (
    receiverId: string,
    proposerCash: number,
    proposerProps: number[],
    receiverCash: number,
    receiverProps: number[]
  ) => {
    const { room } = get();
    if (!room) return null;
    set({ error: null });
    try {
      const { data, error } = await supabase.rpc('propose_trade', {
        p_room_id: room.id,
        p_proposer_id: get().userId,
        p_receiver_id: receiverId,
        p_proposer_cash: proposerCash,
        p_proposer_properties: proposerProps,
        p_receiver_cash: receiverCash,
        p_receiver_properties: receiverProps
      });
      if (error) throw error;
      return data;
    } catch (err: any) {
      set({ error: err.message });
      return null;
    }
  },

  acceptTrade: async (tradeId: string) => {
    set({ error: null });
    try {
      const { error } = await supabase.rpc('accept_trade', {
        p_trade_id: tradeId,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  rejectTrade: async (tradeId: string) => {
    set({ error: null });
    try {
      const { error } = await supabase.rpc('reject_trade', {
        p_trade_id: tradeId,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  declareBankruptcy: async () => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('declare_bankruptcy', {
        p_room_id: room.id,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  endTurn: async () => {
    const { room } = get();
    if (!room) return;
    set({ error: null });
    try {
      const { error } = await supabase.rpc('end_turn', {
        p_room_id: room.id,
        p_user_id: get().userId
      });
      if (error) throw error;
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchRoomData: async (roomId: string) => {
    const { data: roomData, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (roomErr) return;

    const { data: playersData, error: playersErr } = await supabase
      .from('room_players')
      .select('*')
      .eq('room_id', roomId)
      .order('turn_order', { ascending: true });
    if (playersErr) return;

    const { data: stateData } = await supabase
      .from('game_states')
      .select('*')
      .eq('room_id', roomId)
      .single();

    const { data: tradesData } = await supabase
      .from('game_trades')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'PENDING');

    set({
      room: roomData,
      players: playersData || [],
      gameState: stateData || null,
      trades: tradesData || []
    });
  }
}));