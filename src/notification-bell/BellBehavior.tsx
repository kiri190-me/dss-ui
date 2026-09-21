"use client";

import { useEffect, useRef } from "react";
import type { NotificationBellItem } from "./types";

/**
 * 종에 **얹는** 세 가지 — 바깥을 눌러 접기 · Esc 로 접기 · 「확인했다」 알리기.
 *
 * ── 🔴 이것은 얹는 것이지 갈아치우는 것이 아니다 ─────────────────────────
 * 종의 펼침·접힘은 여전히 <details>/<summary> 가, 즉 **브라우저가** 한다. 이
 * 조각이 없거나 스크립트가 아직 안 붙었어도
 *   - 종을 누르면 펼쳐지고 다시 누르면 접히고,
 *   - 줄은 평범한 <a href> 라 눌리면 그대로 나가고,
 *   - 목록도 배지도 제대로 보인다.
 * 여기서 더해지는 것은 바깥을 눌러 접기 · Esc 로 접기 · **확인 기록** 셋뿐이다.
 * 앞의 둘은 없어도 종을 못 쓰게 되지 않고, 셋째는 실패해도 **이동을 막지
 * 않는다**(그 줄이 종에 남을 뿐이다 — A/S 가 같은 판단을 이미 하고 있다).
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
}: {
  items: readonly NotificationBellItem[];
  onAcknowledge?: (item: NotificationBellItem) => void;
}): null {
  const latest = useRef({ items, onAcknowledge });

  // 그리는 동안이 아니라 그린 **뒤에** 담는다(렌더 중에 ref 를 건드리면
  // React 가 같은 렌더를 두 번 돌릴 때 값이 어긋난다).
  useEffect(() => {
    latest.current = { items, onAcknowledge };
  });

  useEffect(
    () =>
      watchBell(document, {
        openHandles: () => openBells(document),
        acknowledge: (target) => {
          const picked = pickNotification(latest.current.items, notificationKeyFromTarget(target));
          if (picked === null) return;
          notifyAcknowledged(picked, latest.current.onAcknowledge);
        },
      }),
    []
  );

  return null;
}
