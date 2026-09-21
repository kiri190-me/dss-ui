"use client";

import { useEffect, useRef } from "react";
import { BELL_OPENED_EVENT } from "./events";
import type { NotificationBellItem } from "./types";

/**
 * 종에 **얹는** 네 가지 — 바깥을 눌러 접기 · Esc 로 접기 · 「확인했다」 알리기 ·
 * 「펼쳐졌다」 알리기.
 *
 * ── 🔴 이것은 얹는 것이지 갈아치우는 것이 아니다 ─────────────────────────
 * 종의 펼침·접힘은 여전히 <details>/<summary> 가, 즉 **브라우저가** 한다. 이
 * 조각이 없거나 스크립트가 아직 안 붙었어도
 *   - 종을 누르면 펼쳐지고 다시 누르면 접히고,
 *   - 줄은 평범한 <a href> 라 눌리면 그대로 나가고,
 *   - 목록도 배지도 제대로 보인다.
 * 여기서 더해지는 것은 바깥을 눌러 접기 · Esc 로 접기 · **확인 기록** ·
 * **「펼쳐졌다」 알림** 넷뿐이다. 앞의 둘은 없어도 종을 못 쓰게 되지 않고,
 * 셋째는 실패해도 **이동을 막지 않는다**(그 줄이 종에 남을 뿐이다 — A/S 가
 * 같은 판단을 이미 하고 있다). 넷째는 듣는 사람이 없으면 아무 일도 아니다.
 *
 * 그래서 NotificationBell 은 서버 컴포넌트로 남는다. "use client" 는 이 파일
 * 하나에만 붙는다 — 아무것도 그리지 않는 이 조각이 클라이언트 경계다.
 *
 * ── 🔴 그리는 것이 없다 ──────────────────────────────────────────────────
 * null 을 돌려준다. 마크업이 한 글자도 늘지 않으므로 서버에서 그린 것과
 * 브라우저에서 그린 것이 같아 hydration 이 어긋나지 않는다. 그릴 것이 없으니
 * 붙잡을 DOM 마디도 없다 — 아래 손잡이는 우리 클래스로 찾는다.
 *
 * ── 🔴 서버에서 그릴 때 안전하다 ─────────────────────────────────────────
 * 화면의 물건(document)을 만지는 곳은 useEffect **안**뿐이다. 그리는 동안에는
 * 아무것도 만지지 않으므로 react-dom/server 로 그려도 터지지 않는다(node 에는
 * document 가 아예 없어서, 만지는 순간 시험이 바로 빨개진다).
 *
 * ── 왜 메뉴바의 DropdownDismiss 를 가져다 쓰지 않나 ───────────────────────
 * 하는 일이 거의 같지만 **셋째(확인)가 다르다** — 그쪽에는 줄을 누른 것을
 * 알아채는 일이 아예 없다. 그 파일은 지금 세 사이트가 싣고 있어서, 새 조각을
 * 위해 그 안을 넓히면 세 사이트가 함께 흔들린다. 같은 저장소 안이지만 조각끼리
 * 서로를 부르지 않는 편이(폴더 하나가 제 것만 갖는 편이) 그쪽을 고칠 때 안전하다.
 */

/** 지금 **펼쳐져 있는** 이 묶음의 종만 고른다. 접힌 것은 손잡이로 싸지 않는다. */
const OPEN_BELLS = "details.dss-bell[open]";

/** 알림 줄. 눌린 자리에서 위로 올라가며 이것을 찾는다. */
const LINK = "a.dss-bell__link";

/** 줄이 제 열쇠를 들고 있는 칸. 마크업(NotificationBell)과 한 짝이다. */
const KEY_ATTRIBUTE = "data-notification-key";

/**
 * 붙였다 떼는 방식.
 *
 * capture 로 듣는 이유: 중간의 누군가가 stopPropagation 을 부르면 버블 단계의
 * 리스너는 사건을 못 듣는다(머리말 안에 앉는 조각이라 실제로 남의 손이 닿는
 * 자리다). 우리는 듣기만 하고 preventDefault 도 stopPropagation 도 하지
 * 않으므로, 먼저 듣는다고 해서 사이트 쪽 동작을 가로채지 않는다.
 *
 * 🔴 떼어낼 때도 **같은 옵션**을 넘겨야 한다 — capture 가 다르면 브라우저는
 *    다른 리스너로 보고 떼지 않는다. 그래서 값을 한 곳에 두고 양쪽이 같이 쓴다.
 */
const LISTEN = { capture: true } as const;

/**
 * 접을 수 있는 종 하나. **진짜 DOM 이 아니라 이 최소한의 모양**만 받는다 —
 * 덕분에 브라우저 없이 시험할 수 있다(이 저장소의 시험은 jsdom 을 두지 않는다).
 */
export type BellHandle = {
  /** 누른 자리(초점이 있는 곳)가 이 종 **안**인가. */
  contains(node: EventTarget | null): boolean;
  /** 접는다. 초점이 안에 있었으면 종 단추로 돌려준다. */
  close(): void;
};

/** 사건을 듣는 곳(실제로는 document). 시험에서는 가짜를 넣는다. */
export type BellEventHost = {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions
  ): void;
};

/**
 * 누른 자리가 **바깥**인 종만 접는다.
 *
 * 🔴 목록 안을 누른 것은 바깥이 아니다. 줄을 누르면 어차피 다른 화면으로
 *    나가면서 사라지지만, 그 사이(사내망에서는 한참일 수 있다) 목록이 눈앞에서
 *    사라지면 「눌리긴 한 건가」 싶어진다. 게다가 목록은 제 안에서 세로로
 *    굴러가므로, 굴리려고 짚은 손가락에 접히면 못 쓴다.
 */
export function dismissOutsideBell(
  handles: readonly BellHandle[],
  target: EventTarget | null
): void {
  for (const handle of handles) {
    if (handle.contains(target)) continue;
    handle.close();
  }
}

/** 펼쳐진 것을 전부 접는다(Esc). */
export function dismissAllBells(handles: readonly BellHandle[]): void {
  for (const handle of handles) {
    handle.close();
  }
}

/**
 * 눌린 자리가 알림 줄이면 그 줄의 **열쇠**를, 아니면 null 을.
 *
 * `instanceof Element` 로 묻지 않는 이유: node 에는 Element 가 아예 없어서 그
 * 한 줄이 시험을 통째로 죽인다. 대신 **물어보는 방식**으로 가린다 — closest 를
 * 가진 것만 마디로 친다. 가짜 마디로 시험할 수 있다는 덤이 따라온다.
 */
type LinkLike = { getAttribute(name: string): string | null };
type NodeLike = { closest(selector: string): LinkLike | null };

export function notificationKeyFromTarget(target: EventTarget | null): string | null {
  const candidate = target as NodeLike | null;
  if (candidate === null || typeof candidate.closest !== "function") return null;
  const link = candidate.closest(LINK);
  return link === null ? null : link.getAttribute(KEY_ATTRIBUTE);
}

/** 열쇠로 줄을 되찾는다. 못 찾으면 null — 남의 링크를 누른 것이다. */
export function pickNotification(
  items: readonly NotificationBellItem[],
  key: string | null
): NotificationBellItem | null {
  if (key === null) return null;
  return items.find((item) => item.key === key) ?? null;
}

/**
 * 「이 줄을 눌렀다」를 사이트에 알린다.
 *
 * 🔴 **이 묶음은 서버를 모른다.** 확인을 어디에 적을지, 애초에 이 종류가 눌러
 *    확인하는 종류인지조차 여기서 정하지 않는다 — 그건 그 알림을 만든 시스템만
 *    아는 것이다(A/S 는 domain/notification-acknowledgement.ts 한 곳이 정한다).
 *    묶음은 **받은 함수를 부르기만** 한다.
 *
 * 🔴 **던져도 밖으로 나가지 않는다.** 이 함수는 링크를 누른 그 순간에 불리는데,
 *    여기서 예외가 새면 그 줄이 향하던 화면으로 가는 일까지 흔들린다. 확인을
 *    못 적으면 그 줄이 종에 남을 뿐이다 — 이동이 막히는 쪽이 훨씬 나쁘다.
 */
export function notifyAcknowledged(
  item: NotificationBellItem,
  onAcknowledge?: (item: NotificationBellItem) => void
): void {
  if (!onAcknowledge) return;
  try {
    onAcknowledge(item);
  } catch {
    // 확인을 못 적어도 이동은 막지 않는다.
  }
}

/**
 * 방금 **펼쳐진** 우리 종인가.
 *
 * `toggle` 은 펼칠 때도 접을 때도 같은 이름으로 온다 — 어느 쪽인지는 사건이
 * 아니라 **마디의 지금 상태**로 가린다. 사건이 손에 들어올 때 `open` 속성은
 * 이미 새 값이라, 「펼쳐진 우리 종」을 그대로 물어보면 된다(OPEN_BELLS).
 *
 * `instanceof Element` 로 묻지 않는 이유는 notificationKeyFromTarget 과 같다 —
 * node 에는 Element 가 없다. matches 를 가진 것만 마디로 친다.
 */
type MatchLike = { matches(selector: string): boolean };

export function isOpenedBell(target: EventTarget | null): boolean {
  const candidate = target as Partial<MatchLike> | null;
  if (candidate === null || typeof candidate.matches !== "function") return false;
  return candidate.matches(OPEN_BELLS);
}

/**
 * 사건을 **던지는** 곳(실제로는 창). 시험에서는 진짜 EventTarget 을 넣는다.
 * 듣는 곳(BellEventHost)과 모양이 다르므로 타입을 따로 둔다.
 */
export type BellAnnounceHost = {
  dispatchEvent(event: Event): boolean;
};

/**
 * 「종이 펼쳐졌다」를 **두 갈래로** 알린다 — 받은 함수와 창 사건.
 *
 * 🔴 둘 다 부르는 까닭: 함수는 client 그래프에서 종을 그리는 사이트(A/S 의
 *    AppShell)가 쓰고, 창 사건은 서버에서 그리는 사이트(개선요청)가 쓴다.
 *    어느 쪽을 쓸지 묶음이 고르지 않는다 — 둘 다 내주고 사이트가 고른다.
 *
 * 🔴 **한쪽이 넘어져도 다른 쪽은 부른다.** 사이트가 넘긴 함수에서 예외가
 *    새면 브라우저의 사건 처리가 통째로 멈추는데, 그때 잃는 것이 「숫자를
 *    다시 세기」 하나가 아니라 이 조각이 얹은 나머지까지가 된다.
 */
export function announceBellOpened(
  host: BellAnnounceHost | null,
  onOpen?: () => void
): void {
  if (onOpen) {
    try {
      onOpen();
    } catch {
      // 사이트가 넘어져도 창 사건은 그대로 던진다.
    }
  }

  if (host === null) return;

  try {
    // 🔴 bubbles 도 cancelable 도 주지 않는다. 창에서 시작해 창에서 끝나는
    //    알림이고, 막을 수 있는 것이 아니다.
    host.dispatchEvent(new Event(BELL_OPENED_EVENT));
  } catch {
    // 듣는 사람이 없어도, 사건을 못 만드는 환경이어도 종은 그대로 쓴다.
  }
}

/**
 * 종이 **펼쳐지는** 것을 듣기 시작하고, 떼어내는 함수를 돌려준다.
 *
 * 🔴 watchBell 과 **따로** 두는 까닭: 저쪽 셋은 「열린 종을 어떻게 접나」라는
 *    한 가지 일이고 이것은 다른 일이다. 무엇보다 저 함수의 시험이 「셋을
 *    붙이고 셋을 뗀다」를 못 박고 있어, 거기에 넷째를 밀어 넣으면 이미
 *    네 사이트가 쓰는 동작의 시험을 고쳐야 한다. 나누면 아무것도 안 건드린다.
 *
 * 🔴 `toggle` 은 **버블하지 않는다.** 그래도 document 에서 잡히는 것은
 *    capture 단계로 듣기 때문이다 — 캡처는 bubbles 와 무관하게 조상부터
 *    내려온다. LISTEN 을 그대로 쓰는 것이 그래서 중요하다.
 */
export function watchBellOpened(host: BellEventHost, deps: { opened: () => void }): () => void {
  const onToggle = (event: Event) => {
    // 접힌 것도, 남의 <details> 도 아니다 — 방금 펼쳐진 우리 종만.
    if (!isOpenedBell(event.target)) return;
    deps.opened();
  };

  host.addEventListener("toggle", onToggle, LISTEN);

  return () => {
    host.removeEventListener("toggle", onToggle, LISTEN);
  };
}

/**
 * 진짜 화면에서 **지금** 펼쳐져 있는 종들을 집어 손잡이로 싼다.
 *
 * 사건이 올 때마다 다시 찾는다(한 번 찾아 두고 쓰지 않는다). 종은 사이트가
 * 그리는 것이라 다시 그려질 수도, 없어졌다 생길 수도 있는데, 붙잡아 둔 마디는
 * 그때 이미 화면에서 떨어져 나간 것이 된다.
 */
export function openBells(root: Document): BellHandle[] {
  const handles: BellHandle[] = [];

  root.querySelectorAll<HTMLDetailsElement>(OPEN_BELLS).forEach((bell) => {
    handles.push({
      // node 가 아닌 것(창 자체 같은)이 오면 contains 가 던진다 — 그런 것은
      // 어차피 이 종 안이 아니므로 「바깥」으로 친다.
      contains: (node) => node instanceof Node && bell.contains(node),
      close: () => {
        // 🔴 접기 **전에** 본다. 접으면 안에 있던 것이 화면에서 사라져, 거기
        //    있던 초점이 갈 곳을 잃는다(문서 맨 처음으로 튄다). 키보드로
        //    목록을 훑다가 Esc 를 누른 사람은 종으로 돌아와야 한다.
        const heldFocus = bell.contains(root.activeElement);
        bell.open = false;
        if (heldFocus) bell.querySelector("summary")?.focus();
      },
    });
  });

  return handles;
}

/**
 * 듣기 시작하고, **떼어내는 함수**를 돌려준다.
 *
 * 🔴 뒷정리가 이 함수의 절반이다. 화면이 사라질 때 떼지 않으면 리스너가 쌓여,
 *    화면을 오갈수록 누를 때마다 하는 일이 늘어난다.
 *
 * 무엇을 듣는가:
 *   - `pointerdown` — 마우스 · **손가락** · 펜을 한 번에 받는다. `click` 으로
 *     들으면 iOS 에서 빈 바탕을 누른 것이 문서까지 오지 않아 **폰에서만** 바깥
 *     클릭이 안 먹는다.
 *   - `keydown` 의 Esc — 바깥을 누를 수 없는 키보드 사용자에게는 닫을 유일한
 *     길이다. preventDefault 를 하지 않으므로 사이트의 다른 Esc 처리를
 *     가로채지 않고, 펼쳐진 종이 없으면 아무 일도 하지 않는다.
 *   - `click` — 줄을 눌러 **확인**한 것. 여기서는 pointerdown 이 아니라 click
 *     이라야 한다: 손가락을 댔다가 떼지 않고 미끄러뜨려 목록을 굴린 것까지
 *     「눌렀다」로 세면, 읽지도 않은 알림이 확인되어 사라진다.
 */
export function watchBell(
  host: BellEventHost,
  deps: {
    openHandles: () => readonly BellHandle[];
    /** 눌린 자리를 넘긴다. 알림 줄이 아니면 아무 일도 일어나지 않는다. */
    acknowledge: (target: EventTarget | null) => void;
  }
): () => void {
  const onPointerDown = (event: Event) => {
    dismissOutsideBell(deps.openHandles(), event.target);
  };

  const onKeyDown = (event: Event) => {
    // "keydown" 으로 받은 것이라 KeyboardEvent 다.
    if ((event as KeyboardEvent).key !== "Escape") return;
    dismissAllBells(deps.openHandles());
  };

  const onClick = (event: Event) => {
    deps.acknowledge(event.target);
  };

  host.addEventListener("pointerdown", onPointerDown, LISTEN);
  host.addEventListener("keydown", onKeyDown, LISTEN);
  host.addEventListener("click", onClick, LISTEN);

  return () => {
    host.removeEventListener("pointerdown", onPointerDown, LISTEN);
    host.removeEventListener("keydown", onKeyDown, LISTEN);
    host.removeEventListener("click", onClick, LISTEN);
  };
}

/**
 * 종 안에 곁들이는 조각. **아무것도 그리지 않는다.**
 *
 * NotificationBell 이 <details> 안에 하나 둔다 — 목록이 비면 종 자체가 없으므로
 * 이 조각도 없다.
 *
 * 🔴 **붙였다 떼는 일은 딱 한 번**이다(의존성이 빈 useEffect). 목록이나 확인
 *    함수가 바뀔 때마다 다시 붙이면, 사이트가 화면을 자주 다시 그리는 동안
 *    리스너를 붙였다 떼는 일만 하게 된다. 대신 **가장 최근 값을 담아 두는
 *    상자**(ref)를 두고 사건이 올 때 거기서 꺼낸다 — 사건은 언제나 지금
 *    화면에 있는 목록을 본다.
 */
export function BellBehavior({
  items,
  onAcknowledge,
  onOpen,
}: {
  items: readonly NotificationBellItem[];
  onAcknowledge?: (item: NotificationBellItem) => void;
  /** 종이 펼쳐진 순간. 없어도 창 사건은 그대로 던진다(announceBellOpened). */
  onOpen?: () => void;
}): null {
  const latest = useRef({ items, onAcknowledge, onOpen });

  // 그리는 동안이 아니라 그린 **뒤에** 담는다(렌더 중에 ref 를 건드리면
  // React 가 같은 렌더를 두 번 돌릴 때 값이 어긋난다).
  useEffect(() => {
    latest.current = { items, onAcknowledge, onOpen };
  });

  useEffect(() => {
    const unwatch = watchBell(document, {
      openHandles: () => openBells(document),
      acknowledge: (target) => {
        const picked = pickNotification(latest.current.items, notificationKeyFromTarget(target));
        if (picked === null) return;
        notifyAcknowledged(picked, latest.current.onAcknowledge);
      },
    });

    // 🔴 창에 던진다(문서가 아니라). 서버에서 종을 그리는 사이트는 함수를
    //    넘길 수 없어 이 사건이 유일한 길인데, 사이트의 client 조각이 귀를
    //    붙이기 가장 쉬운 곳이 창이다.
    const unwatchOpen = watchBellOpened(document, {
      opened: () => announceBellOpened(window, latest.current.onOpen),
    });

    return () => {
      unwatch();
      unwatchOpen();
    };
  }, []);

  return null;
}
