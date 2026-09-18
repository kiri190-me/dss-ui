"use client";

import { useEffect } from "react";

/**
 * 펼쳐 둔 드롭다운을 **바깥을 눌렀을 때 · Esc 를 눌렀을 때** 접는다.
 *
 * ── 🔴 이것은 「얹는 것」이지 갈아치우는 것이 아니다 ──────────────────────
 * 메뉴바의 펼침·접힘은 여전히 <details>/<summary> 가, 즉 **브라우저가** 한다.
 * 이 조각이 없거나 스크립트가 아직 안 붙었어도
 *   - 단추를 누르면 펼쳐지고 다시 누르면 접히고,
 *   - 목록의 링크는 평범한 <a href> 라 눌리면 그대로 나가고,
 *   - 목록은 제대로 보인다.
 * 여기서 더해지는 것은 **바깥을 눌러 접기**와 **Esc 로 접기** 둘뿐이다 —
 * 있으면 편하지만 없어도 메뉴를 못 쓰게 되지는 않는 것들이다.
 * (그래서 ServiceMenuBar 는 서버 컴포넌트로 남는다. "use client" 는 이 파일
 *  하나에만 붙는다 — 아무것도 그리지 않는 이 조각이 클라이언트 경계다.)
 *
 * ── 🔴 그리는 것이 없다 ──────────────────────────────────────────────────
 * null 을 돌려준다. 마크업이 한 글자도 늘지 않으므로
 *   - 기본 모습(variant="bar")은 물론 드롭다운 모습의 마크업도 그대로고,
 *   - 서버에서 그린 것과 브라우저에서 그린 것이 같아 hydration 이 어긋나지
 *     않는다.
 * 그릴 것이 없으니 붙잡을 DOM 마디도 없다 — 그래서 아래 손잡이는 우리
 * 클래스(`details.dss-menu__dropdown`)로 찾는다. 남의 <details> 는 건드리지
 * 않는다.
 *
 * ── 🔴 서버에서 그릴 때 안전하다 ─────────────────────────────────────────
 * 화면의 물건(document)을 만지는 곳은 useEffect **안**뿐이다. 그리는 동안에는
 * 아무것도 만지지 않으므로 react-dom/server 로 그려도 터지지 않는다
 * (node 에는 document 가 아예 없어서, 만지는 순간 시험이 바로 빨개진다).
 */

/**
 * 지금 **펼쳐져 있는** 이 묶음의 드롭다운만 고른다.
 *
 * `[open]` 을 선택자에 넣어 둔 덕에 「열려 있는가」를 따로 물어볼 필요가 없다.
 * 접혀 있는 것은 애초에 손잡이로 싸지지 않는다.
 */
const OPEN_DROPDOWNS = "details.dss-menu__dropdown[open]";

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
 * 접을 수 있는 드롭다운 하나. **진짜 DOM 이 아니라 이 최소한의 모양**만 받는다
 * — 덕분에 브라우저 없이 시험할 수 있다(이 저장소의 시험은 jsdom 을 두지
 * 않는다. no-network.test.ts 참조).
 */
export type DropdownHandle = {
  /** 누른 자리(초점이 있는 곳)가 이 드롭다운 **안**인가. */
  contains(node: EventTarget | null): boolean;
  /** 접는다. 초점이 안에 있었으면 단추로 돌려준다. */
  close(): void;
};

/** 사건을 듣는 곳(실제로는 document). 시험에서는 가짜를 넣는다. */
export type DropdownEventHost = {
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
 * 누른 자리가 **바깥**인 드롭다운만 접는다.
 *
 * 🔴 목록 안을 누른 것은 바깥이 아니다. 링크를 누르면 어차피 다른 사이트로
 *    나가면서 화면이 통째로 바뀌지만, 그 사이(사내망에서는 한참일 수 있다)
 *    목록이 눈앞에서 사라지면 「눌리긴 한 건가」 싶어진다. 게다가 목록은 제
 *    안에서 세로로 굴러가므로, 굴리려고 짚은 손가락에 접히면 못 쓴다.
 */
export function dismissOutside(
  handles: readonly DropdownHandle[],
  target: EventTarget | null
): void {
  for (const handle of handles) {
    if (handle.contains(target)) continue;
    handle.close();
  }
}

/** 펼쳐진 것을 전부 접는다(Esc). */
export function dismissAll(handles: readonly DropdownHandle[]): void {
  for (const handle of handles) {
    handle.close();
  }
}

/**
 * 진짜 화면에서 **지금** 펼쳐져 있는 드롭다운들을 집어 손잡이로 싼다.
 *
 * 사건이 올 때마다 다시 찾는다(한 번 찾아 두고 쓰지 않는다). 메뉴바는
 * 사이트가 그리는 것이라 다시 그려질 수도, 없어졌다 생길 수도 있는데,
 * 붙잡아 둔 마디는 그때 이미 화면에서 떨어져 나간 것이 된다.
 */
export function openDropdowns(root: Document): DropdownHandle[] {
  const handles: DropdownHandle[] = [];

  root.querySelectorAll<HTMLDetailsElement>(OPEN_DROPDOWNS).forEach((dropdown) => {
    handles.push({
      // node 가 아닌 것(창 자체 같은)이 오면 contains 가 던진다 — 그런 것은
      // 어차피 이 드롭다운 안이 아니므로 「바깥」으로 친다.
      contains: (node) => node instanceof Node && dropdown.contains(node),
      close: () => {
        // 🔴 접기 **전에** 본다. 접으면 안에 있던 것이 화면에서 사라져,
        //    거기 있던 초점이 갈 곳을 잃는다(문서 맨 처음으로 튄다).
        //    키보드로 목록을 훑다가 Esc 를 누른 사람은 단추로 돌아와야
        //    바로 다시 펼치거나 다음 칸으로 나아갈 수 있다.
        const heldFocus = dropdown.contains(root.activeElement);
        dropdown.open = false;
        if (heldFocus) {
          // 이 드롭다운의 <summary> 는 하나뿐이다(ServiceMenuBar 가 그렇게
          // 그린다). 없더라도 ?. 로 조용히 지나간다.
          dropdown.querySelector("summary")?.focus();
        }
      },
    });
  });

  return handles;
}

/**
 * 듣기 시작하고, **떼어내는 함수**를 돌려준다.
 *
 * 🔴 뒷정리가 이 함수의 절반이다. 화면이 사라질 때 떼지 않으면 리스너가
 *    쌓여, 화면을 오갈수록 누를 때마다 하는 일이 늘어난다. 돌려준 함수를
 *    useEffect 가 그대로 뒷정리로 쓴다.
 *
 * 무엇을 듣는가:
 *   - `pointerdown` — 마우스 · **손가락** · 펜을 한 번에 받는다. `click` 으로
 *     듣지 않는 이유가 폰이다: iOS 는 누를 것이 아닌 곳(빈 바탕 등)에서 click
 *     을 문서까지 올려 보내지 않아, 폰에서만 바깥 클릭이 안 먹는 일이 생긴다.
 *     `mousedown` 도 같은 이유로 부족하다(손가락은 그것을 내지 않는 기기가
 *     있다). `pointerdown` 하나면 셋 다 온다.
 *   - `keydown` 의 Esc — 드롭다운에서 사람들이 기대하는 동작이고, 바깥을 누를
 *     수 없는 키보드 사용자에게는 **닫을 유일한 길**이다. preventDefault 를
 *     하지 않으므로 사이트의 다른 Esc 처리(팝업 닫기 등)를 가로채지 않고,
 *     펼쳐진 드롭다운이 없으면 아무 일도 하지 않는다.
 */
export function watchDropdowns(
  host: DropdownEventHost,
  openHandles: () => readonly DropdownHandle[]
): () => void {
  const onPointerDown = (event: Event) => {
    dismissOutside(openHandles(), event.target);
  };

  const onKeyDown = (event: Event) => {
    // "keydown" 으로 받은 것이라 KeyboardEvent 다.
    if ((event as KeyboardEvent).key !== "Escape") return;
    dismissAll(openHandles());
  };

  host.addEventListener("pointerdown", onPointerDown, LISTEN);
  host.addEventListener("keydown", onKeyDown, LISTEN);

  return () => {
    host.removeEventListener("pointerdown", onPointerDown, LISTEN);
    host.removeEventListener("keydown", onKeyDown, LISTEN);
  };
}

/**
 * 드롭다운 안에 곁들이는 조각. **아무것도 그리지 않는다.**
 *
 * ServiceMenuBar 가 `variant="inline"` 일 때만 <details> 안에 하나 둔다 —
 * 기본 모습(variant="bar")에는 <details> 자체가 없으므로 이 조각도 없다.
 */
export function DropdownDismiss(): null {
  useEffect(() => watchDropdowns(document, () => openDropdowns(document)), []);

  return null;
}
