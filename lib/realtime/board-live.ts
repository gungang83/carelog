import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * 상담보드 실시간 진행 현황 broadcast (C-05 1단계).
 *
 * 작성 중인 보드가 "지금 누가 어느 체어에서 상담을 작성 중"인지 같은 기관 기기에
 * 실시간으로 알린다. 다른 기기는 이를 받아 "진행 중인 상담" 배너로 보여준다.
 *
 * ⚠️ 개인정보(헌법 I): broadcast 전송선엔 **상담 본문·환자 식별정보를 싣지 않는다.**
 *    작성자·체어명·경과·글자수 같은 메타만 보낸다. 본문 실시간 공유는 인증된 경로
 *    (서버 draft + RLS)가 필요해 2단계로 미룬다.
 *
 * broadcast는 RLS가 없고 채널명만으로 구독되므로, 메타만 보내는 이 제약이 중요하다.
 */
export type BoardLivePayload = {
  sessionId: string;
  author: string;
  chairName: string;
  startedAt: number;
  charCount: number;
  ended?: boolean;
};

function channelName(institutionId: string) {
  return `institution:${institutionId}:board-live`;
}

export function createBoardLivePublisher(institutionId: string) {
  const supabase = createBrowserSupabaseClient();
  const channel = supabase.channel(channelName(institutionId), {
    config: { broadcast: { self: false } },
  });
  channel.subscribe();
  return {
    publish(payload: BoardLivePayload) {
      void channel.send({ type: "broadcast", event: "board", payload });
    },
    close() {
      void supabase.removeChannel(channel);
    },
  };
}

export function subscribeBoardLive(
  institutionId: string,
  onEvent: (p: BoardLivePayload) => void,
): () => void {
  const supabase = createBrowserSupabaseClient();
  const channel = supabase
    .channel(channelName(institutionId), {
      config: { broadcast: { self: false } },
    })
    .on("broadcast", { event: "board" }, (msg) => {
      onEvent(msg.payload as BoardLivePayload);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
