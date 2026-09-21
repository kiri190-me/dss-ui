import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BellBehavior,
  dismissAllBells,
  dismissOutsideBell,
  notificationKeyFromTarget,
  notifyAcknowledged,
  pickNotification,
  watchBell,
  type BellEventHost,
  type BellHandle,
} from "./BellBehavior";
import type { NotificationBellItem } from "./types";

/**
 * 얹은 셋(바깥 눌러 접기 · Esc · 확인)을 **브라우저 없이** 시험한다.
 *
 * 어떻게 브라우저 없이 되나: 접는 판단과 사건을 붙였다 떼는 일이 진짜 DOM 을
 * 몰라도 되게 갈라져 있다 — BellHandle 과 BellEventHost 는 각각 「접을 수
 * 있는 것」과 「사건을 듣는 곳」의 최소 모양이고, 여기서는 가짜를 끼운다.
 * 진짜 document 를 그 자리에 넣는 곳은 openBells / BellBehavior 딱 둘이다.
 *
 * 🔴 이 조각이 **없어도 종은 돌아간다**는 것(펼침·접힘·링크)은 여기가 아니라
 *    NotificationBell.test.tsx 가 마크업으로 못 박는다.
 */

const 줄하나: NotificationBellItem = {
  key: "dss-as:APPROVAL:1",
  sourceId: "dss-as",
  sourceName: "A/S 관리",
  id: "APPROVAL:1",
  kind: "REPAIR_CASE_APPROVAL",
  kindLabel: "결재 대기",
  subject: "2026-0001",
  detail: "수리 검수 승인",
  href: "https://as.example/x",
};

/** 누른 자리 — 진짜 DOM 마디가 아니어도 된다. 견주기만 한다. */
function 자리(): EventTarget {
  return {} as EventTarget;
}

/** 접을 수 있는 가짜 종 하나. `안쪽` 에 든 자리를 누른 것만 「안」으로 친다. */
function 가짜종(...안쪽: readonly EventTarget[]) {
  let 접힌횟수 = 0;

  const handle: BellHandle = {
    contains: (node) => node !== null && 안쪽.includes(node),
    close: () => {
      접힌횟수 += 1;
    },
  };

  return { handle, 접힌횟수: () => 접힌횟수 };
}

type 등록 = {
  type: string;
  listener: (event: Event) => void;
  options?: boolean | AddEventListenerOptions;
};

/** 사건을 듣는 가짜 곳. 무엇을 붙였고 무엇을 뗐는지 그대로 적어 둔다. */
function 가짜듣는곳() {
  const 붙인것: 등록[] = [];
  const 뗀것: 등록[] = [];

  const host: BellEventHost = {
    addEventListener: (type, listener, options) => {
      붙인것.push({ type, listener, options });
    },
    removeEventListener: (type, listener, options) => {
      뗀것.push({ type, listener, options });
    },
  };

  /** 아직 붙어 있는 리스너에게만 사건을 넘긴다 — 뗀 것은 부르지 않는다. */
  function 알린다(type: string, event: Partial<Event> & Record<string, unknown>) {
    for (const 하나 of 붙인것) {
      if (하나.type !== type) continue;
      if (뗀것.some((뗀) => 뗀.listener === 하나.listener)) continue;
      하나.listener(event as Event);
    }
  }

  return { host, 붙인것, 뗀것, 알린다 };
}

/** 알림 줄처럼 굴지만 진짜 DOM 은 아닌 것. closest 를 가졌다는 것만 같다. */
function 가짜줄마디(key: string | null): EventTarget {
  return {
    closest: (selector: string) =>
      selector === "a.dss-bell__link" ? { getAttribute: () => key } : null,
  } as unknown as EventTarget;
}

test("바깥을 누르면 접고, 안을 누르면 두어 둔다", () => {
  const 안쪽 = 자리();
  const 종 = 가짜종(안쪽);

  dismissOutsideBell([종.handle], 자리());
  assert.equal(종.접힌횟수(), 1);

  dismissOutsideBell([종.handle], 안쪽);
  assert.equal(종.접힌횟수(), 1, "목록 안을 누른 것은 바깥이 아니다");
});

test("Esc 는 펼쳐진 것을 전부 접는다", () => {
  const 첫째 = 가짜종();
  const 둘째 = 가짜종();

  dismissAllBells([첫째.handle, 둘째.handle]);

  assert.equal(첫째.접힌횟수(), 1);
  assert.equal(둘째.접힌횟수(), 1);
});

test("🔴 셋을 붙이고, 뒷정리에서 **전부** 뗀다 — 같은 옵션으로", () => {
  const 듣는곳 = 가짜듣는곳();
  const 뗀다 = watchBell(듣는곳.host, { openHandles: () => [], acknowledge: () => {} });

  assert.deepEqual(
    듣는곳.붙인것.map((하나) => 하나.type).sort(),
    ["click", "keydown", "pointerdown"]
  );
  // 🔴 pointerdown 이라야 손가락·펜까지 받는다(click 으로 들으면 iOS 에서
  //    빈 바탕을 누른 것이 문서까지 오지 않아 폰에서만 안 먹는다).
  for (const 하나 of 듣는곳.붙인것) {
    assert.deepEqual(하나.options, { capture: true }, `${하나.type} 를 capture 로 듣지 않는다`);
  }

  뗀다();

  assert.equal(듣는곳.뗀것.length, 3, "떼지 않으면 화면을 오갈수록 리스너가 쌓인다");
  for (const 하나 of 듣는곳.붙인것) {
    const 짝 = 듣는곳.뗀것.find((뗀) => 뗀.listener === 하나.listener);
    assert.ok(짝, `${하나.type} 를 떼지 않았다`);
    assert.deepEqual(짝.options, 하나.options, "옵션이 다르면 브라우저가 떼지 않는다");
  }
});

test("Esc 말고 다른 키는 아무 일도 하지 않는다", () => {
  const 듣는곳 = 가짜듣는곳();
  const 종 = 가짜종();
  watchBell(듣는곳.host, { openHandles: () => [종.handle], acknowledge: () => {} });

  듣는곳.알린다("keydown", { key: "a" });
  assert.equal(종.접힌횟수(), 0);

  듣는곳.알린다("keydown", { key: "Escape" });
  assert.equal(종.접힌횟수(), 1);
});

test("🔴 줄을 누르면 **그 줄로** 확인이 불린다", () => {
  const 듣는곳 = 가짜듣는곳();
  const 불린것: string[] = [];
  watchBell(듣는곳.host, {
    openHandles: () => [],
    acknowledge: (target) => {
      const key = notificationKeyFromTarget(target);
      const picked = pickNotification([줄하나], key);
      if (picked !== null) 불린것.push(picked.id);
    },
  });

  듣는곳.알린다("click", { target: 가짜줄마디(줄하나.key) });
  assert.deepEqual(불린것, [줄하나.id]);

  // 줄이 아닌 곳을 누른 것과 모르는 열쇠는 아무 일도 아니다.
  듣는곳.알린다("click", { target: 자리() });
  듣는곳.알린다("click", { target: 가짜줄마디("남의 열쇠") });
  assert.deepEqual(불린것, [줄하나.id]);
});

test("🔴 확인은 손가락을 댄 때가 아니라 **누른 때**에 센다", () => {
  // pointerdown 으로 들으면 목록을 굴리려고 짚은 손가락에 알림이 확인되어
  // 사라진다 — 읽지도 않은 것이.
  const 듣는곳 = 가짜듣는곳();
  let 불린횟수 = 0;
  watchBell(듣는곳.host, {
    openHandles: () => [],
    acknowledge: () => {
      불린횟수 += 1;
    },
  });

  듣는곳.알린다("pointerdown", { target: 가짜줄마디(줄하나.key) });
  assert.equal(불린횟수, 0);

  듣는곳.알린다("click", { target: 가짜줄마디(줄하나.key) });
  assert.equal(불린횟수, 1);
});

test("줄이 아닌 것에서는 열쇠가 나오지 않는다 — 창 자체를 눌러도 죽지 않는다", () => {
  assert.equal(notificationKeyFromTarget(null), null);
  assert.equal(notificationKeyFromTarget(자리()), null, "closest 가 없는 것은 마디가 아니다");
  assert.equal(notificationKeyFromTarget(가짜줄마디(null)), null, "열쇠 없는 줄");
  assert.equal(notificationKeyFromTarget(가짜줄마디("k")), "k");
});

test("모르는 열쇠로는 아무 줄도 고르지 않는다", () => {
  assert.equal(pickNotification([줄하나], null), null);
  assert.equal(pickNotification([줄하나], "없는 열쇠"), null);
  assert.equal(pickNotification([], 줄하나.key), null);
  assert.equal(pickNotification([줄하나], 줄하나.key), 줄하나);
});

test("🔴 확인 함수가 던져도 밖으로 새지 않는다 — 이동을 막으면 안 된다", () => {
  assert.doesNotThrow(() => notifyAcknowledged(줄하나));
  assert.doesNotThrow(() =>
    notifyAcknowledged(줄하나, () => {
      throw new Error("서버가 죽었다");
    })
  );

  const 받은것: NotificationBellItem[] = [];
  notifyAcknowledged(줄하나, (item) => 받은것.push(item));
  assert.deepEqual(받은것, [줄하나]);
});

test("🔴 서버에서 그려도 터지지 않고, 마크업을 한 글자도 늘리지 않는다", () => {
  assert.equal(renderToStaticMarkup(<BellBehavior items={[줄하나]} />), "");
  assert.equal(renderToStaticMarkup(<BellBehavior items={[]} onAcknowledge={() => {}} />), "");
});
