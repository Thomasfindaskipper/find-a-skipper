'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { EmptyState, initials } from '@/components/ui';
import type { Conversation, Message, Profile } from '@/lib/database.types';

function MessagesInner() {
  const params = useSearchParams();
  const preselected = params.get('conversation');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(preselected);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof as Profile);

      const { data: convs } = await supabase
        .from('conversations')
        .select('*, missions(departure, destination), demandeur:demandeur_id(full_name), skipper:skipper_id(full_name)')
        .or(`demandeur_id.eq.${user.id},skipper_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      setConversations((convs as unknown as Conversation[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const supabase = createClient();
    supabase.from('messages').select('*').eq('conversation_id', activeId).order('created_at', { ascending: true })
      .then(({ data }) => setMessages((data as Message[]) || []));

    const channel = supabase
      .channel(`conv-${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeId]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeId || !profile) return;
    const supabase = createClient();
    const text = draft.trim();
    setDraft('');
    await supabase.from('messages').insert({ conversation_id: activeId, sender_id: profile.id, text });
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>;
  if (!profile) return <main className="max-w-md mx-auto px-6 py-10"><p>Connectez-vous pour accéder à la messagerie.</p></main>;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-6">Messagerie</h1>
      {conversations.length === 0 ? (
        <EmptyState text="Aucune conversation pour l'instant." />
      ) : (
        <div className="rounded-2xl overflow-hidden grid bg-white border border-navy/[0.08]" style={{ gridTemplateColumns: '260px 1fr', minHeight: 440 }}>
          <div className="border-r border-navy/[0.08]">
            {conversations.map((c) => {
              const otherName = profile.role === 'skipper' ? c.demandeur?.full_name : c.skipper?.full_name;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left p-4 flex gap-3 items-start border-b border-navy/[0.06] ${activeId === c.id ? 'bg-lightblue' : ''}`}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-navy text-white">
                    {initials(otherName || '')}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{otherName}</div>
                    <div className="text-xs truncate text-gray-500">
                      {c.missions?.departure}{c.missions?.destination ? ` → ${c.missions.destination}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col">
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">Sélectionnez une conversation</div>
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 380 }}>
                  {messages.length === 0 && <p className="text-sm text-center text-gray-500">Envoyez le premier message.</p>}
                  {messages.map((m) => {
                    const mine = m.sender_id === profile.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${mine ? 'bg-navy text-white' : 'bg-lightblue text-anthracite'}`}>
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={sendMessage} className="p-3 flex gap-2 border-t border-navy/[0.08]">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Écrire un message..."
                    className="flex-1 text-sm border border-gray-200 rounded-[10px] px-3.5 py-2.5 outline-none"
                  />
                  <button type="submit" disabled={!draft.trim()} className="flex items-center justify-center rounded-lg px-4 bg-navy text-white">
                    <Send size={16} />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> Chargement...</div>}>
      <MessagesInner />
    </Suspense>
  );
}
