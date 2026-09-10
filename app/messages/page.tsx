'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, Loader2 } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import { getExtraCopy } from '@/lib/i18n/extra';
import { createClient } from '@/lib/supabase/client';
import { buildVerifyEmailPath, isEmailVerified } from '@/lib/auth';
import { EmptyState, initials } from '@/components/ui';
import type { Conversation, Message, Profile } from '@/lib/database.types';

function upsertMessage(prev: Message[], incoming: Message) {
  if (prev.some((msg) => msg.id === incoming.id)) return prev;

  const optimisticIndex = prev.findIndex(
    (msg) => msg.id.startsWith('tmp-') && msg.sender_id === incoming.sender_id && msg.text === incoming.text
  );

  if (optimisticIndex >= 0) {
    const next = [...prev];
    next[optimisticIndex] = incoming;
    return next;
  }

  return [...prev, incoming];
}

function MessagesInner() {
  const params = useSearchParams();
  const { copy, locale } = useLocale();
  const extra = getExtraCopy(locale);
  const preselected = params.get('conversation');

  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(preselected);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        if (!isEmailVerified(user)) {
          setError(`${copy.verifyEmail.description} ${buildVerifyEmailPath(user.email || null, '/messages')}`);
          return;
        }

        const { data: prof, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profileError) {
          setError(profileError.message);
          return;
        }

        setProfile(prof as Profile);

        const { data: convs, error: convError } = await supabase
          .from('conversations')
          .select('*, missions(departure, destination), demandeur:demandeur_id(full_name), skipper:skipper_id(full_name)')
          .or(`demandeur_id.eq.${user.id},skipper_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (convError) {
          setError(convError.message);
          return;
        }

        setConversations((convs as unknown as Conversation[]) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : extra.errors.loadMessages);
      } finally {
        setLoading(false);
      }
    })();
  }, [copy.verifyEmail.description, extra.errors.loadMessages]);

  useEffect(() => {
    if (!activeId || !profile) return;
    const supabase = createClient();
    (async () => {
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', activeId)
        .or(`demandeur_id.eq.${profile.id},skipper_id.eq.${profile.id}`)
        .maybeSingle();

      if (conversationError || !conversation) {
        setError(conversationError?.message || copy.messages.stale);
        setActiveId(null);
        setMessages([]);
        return;
      }

      const { data: msgs, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeId)
        .order('created_at', { ascending: true });

      if (msgError) {
        setError(msgError.message);
        return;
      }

      setError('');
      setMessages((msgs as Message[]) || []);
    })();

    const channel = supabase
      .channel(`conv-${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` }, (payload) => {
        setMessages((prev) => upsertMessage(prev, payload.new as Message));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeId, copy.messages.stale, profile]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeId) {
      url.searchParams.set('conversation', activeId);
    } else {
      url.searchParams.delete('conversation');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [activeId]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeId || !profile) return;
    const supabase = createClient();
    const text = draft.trim();
    setSending(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isEmailVerified(user)) {
      setSending(false);
      setError(copy.messages.verifyFirst);
      return;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', activeId)
      .or(`demandeur_id.eq.${profile.id},skipper_id.eq.${profile.id}`)
      .maybeSingle();

    if (conversationError || !conversation) {
      setSending(false);
      setError(conversationError?.message || copy.messages.stale);
      return;
    }

    const optimisticId = `tmp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: activeId,
      sender_id: profile.id,
      text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setDraft('');
    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert({ conversation_id: activeId, sender_id: profile.id, text })
      .select('*')
      .single();

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      setDraft(text);
      return;
    }

    if (insertedMessage) {
      setMessages((prev) => upsertMessage(prev.filter((msg) => msg.id !== optimisticId), insertedMessage as Message));
    }
  }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>;
  if (!profile) return <main className="max-w-md mx-auto px-6 py-10"><p>{copy.messages.connect}</p></main>;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold mb-6">{copy.messages.title}</h1>
      {error && (
        <div className="rounded-2xl p-5 mb-6 bg-white border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}
      {conversations.length === 0 ? (
        <EmptyState text={copy.messages.empty} />
      ) : (
        <div className="rounded-2xl overflow-hidden bg-white border border-navy/[0.08] min-h-[440px] md:grid" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div className={`border-r border-navy/[0.08] ${activeId ? 'hidden md:block' : 'block'}`}>
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
          <div className={`flex flex-col ${activeId ? 'block' : 'hidden md:flex'}`}>
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-500">{copy.messages.select}</div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-navy/[0.08] md:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="text-sm font-semibold text-navy"
                  >
                    {copy.messages.back}
                  </button>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {activeConversation?.missions?.departure}
                    {activeConversation?.missions?.destination
                      ? ` → ${activeConversation.missions.destination}`
                      : ''}
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[55vh] md:max-h-[380px]">
                  {messages.length === 0 && <p className="text-sm text-center text-gray-500">{copy.messages.first}</p>}
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
                    placeholder={copy.messages.placeholder}
                    className="flex-1 text-sm border border-gray-200 rounded-[10px] px-3.5 py-2.5 outline-none"
                  />
                  <button type="submit" disabled={!draft.trim() || sending} className="flex items-center justify-center rounded-lg px-4 bg-navy text-white">
                    {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
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
  const { copy } = useLocale();
  return (
    <Suspense fallback={<div className="flex items-center gap-2 py-16 justify-center text-gray-500"><Loader2 className="animate-spin" size={20} /> {copy.common.loading}</div>}>
      <MessagesInner />
    </Suspense>
  );
}
