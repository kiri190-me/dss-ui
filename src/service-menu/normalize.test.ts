import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ICON_LENGTH,
  isSafeServiceUrl,
  normalizeServiceMenu,
} from "./normalize";

/**
 * 토큰에서 꺼낸 값을 거르는 문지기. 여기서 통과한 것만 메뉴바가 그린다.
 * 값은 전부 **손으로 적은 것**이다 — 시험이 네트워크나 DB 를 타지 않는다.
 */

test("배열이 아니면 빈 목록이다 — 클레임이 없는 옛 토큰이 여기로 온다", () => {
  assert.deepEqual(normalizeServiceMenu(undefined), []);
  assert.deepEqual(normalizeServiceMenu(null), []);
  assert.deepEqual(normalizeServiceMenu("dss_services"), []);
  assert.deepEqual(normalizeServiceMenu({ id: "as" }), []);
  assert.deepEqual(normalizeServiceMenu(42), []);
});

test("빈 배열은 빈 목록이다", () => {
  assert.deepEqual(normalizeServiceMenu([]), []);
});

test("포털이 싣는 모양을 그대로 통과시키고 차례를 지킨다", () => {
  const claim = [
    { id: "dss-as", name: "A/S 관리", url: "https://as.example/", icon: "🛠️" },
    { id: "dss-meters", name: "계측기", url: "https://meters.example/" },
    { id: "dss-improvements", name: "개선요청", url: "https://imp.example/", icon: "💡" },
  ];

  assert.deepEqual(normalizeServiceMenu(claim), claim);
  assert.deepEqual(
    normalizeServiceMenu(claim).map((entry) => entry.id),
    ["dss-as", "dss-meters", "dss-improvements"]
  );
});

test("id · name · url 중 하나라도 비면 그 칸만 버린다", () => {
  const menu = normalizeServiceMenu([
    { name: "이름만", url: "https://a.example/" },
    { id: "b", url: "https://b.example/" },
    { id: "c", name: "주소 없음" },
    { id: "  ", name: " ", url: "https://d.example/" },
    { id: "e", name: "정상", url: "https://e.example/" },
  ]);

  assert.deepEqual(menu, [{ id: "e", name: "정상", url: "https://e.example/" }]);
});

test("앞뒤 공백은 떼고 담는다", () => {
  assert.deepEqual(normalizeServiceMenu([{ id: " as ", name: " A/S ", url: " /as " }]), [
    { id: "as", name: "A/S", url: "/as" },
  ]);
});

test("아이콘이 너무 길면 아이콘만 버리고 칸은 남긴다", () => {
  const tooLong = "x".repeat(MAX_ICON_LENGTH + 1);
  const menu = normalizeServiceMenu([
    { id: "as", name: "A/S 관리", url: "https://as.example/", icon: tooLong },
  ]);

  assert.equal(menu.length, 1, "아이콘 하나 때문에 서비스가 사라지면 안 된다");
  assert.equal(menu[0].icon, undefined);
  // 「없다」는 값이 undefined 인 것이 아니라 **키가 없는 것**이다 —
  // 포털이 그렇게 싣고, 받는 쪽이 제 기본값을 쓸 수 있어야 한다.
  assert.equal("icon" in menu[0], false);
});

test("아이콘이 딱 상한 길이면 남긴다", () => {
  const exact = "x".repeat(MAX_ICON_LENGTH);
  assert.equal(
    normalizeServiceMenu([{ id: "as", name: "A/S", url: "/as", icon: exact }])[0].icon,
    exact
  );
});

test("문자열이 아닌 아이콘은 무시한다", () => {
  const menu = normalizeServiceMenu([
    { id: "as", name: "A/S", url: "/as", icon: { evil: true } },
  ]);
  assert.equal("icon" in menu[0], false);
});

test("링크로 그릴 수 없는 주소는 버린다", () => {
  const menu = normalizeServiceMenu([
    { id: "x1", name: "스크립트", url: "javascript:alert(1)" },
    { id: "x2", name: "대문자 스크립트", url: "JavaScript:alert(1)" },
    { id: "x3", name: "데이터", url: "data:text/html,<b>x</b>" },
    { id: "x4", name: "프로토콜 생략", url: "//other.example/" },
    { id: "ok1", name: "http", url: "http://lan.example:3000/" },
    { id: "ok2", name: "https", url: "https://lan.example/" },
    { id: "ok3", name: "같은 사이트", url: "/apps" },
  ]);

  assert.deepEqual(
    menu.map((entry) => entry.id),
    ["ok1", "ok2", "ok3"]
  );
});

test("isSafeServiceUrl 이 홀로도 같은 판단을 한다", () => {
  assert.equal(isSafeServiceUrl("https://a.example/"), true);
  assert.equal(isSafeServiceUrl("http://a.example/"), true);
  assert.equal(isSafeServiceUrl("/apps"), true);
  assert.equal(isSafeServiceUrl("//a.example/"), false);
  assert.equal(isSafeServiceUrl("javascript:alert(1)"), false);
  assert.equal(isSafeServiceUrl("mailto:a@example.com"), false);
  assert.equal(isSafeServiceUrl(""), false);
});

test("id 가 겹치면 먼저 온 것만 남긴다 — 「지금 여기」가 두 칸에 켜지면 안 된다", () => {
  const menu = normalizeServiceMenu([
    { id: "as", name: "먼저", url: "https://a.example/" },
    { id: "as", name: "나중", url: "https://b.example/" },
  ]);

  assert.equal(menu.length, 1);
  assert.equal(menu[0].name, "먼저");
});

test("목록에 섞인 쓰레기(null · 문자열 · 배열)를 건너뛴다", () => {
  const menu = normalizeServiceMenu([
    null,
    "as",
    ["as"],
    undefined,
    { id: "as", name: "A/S", url: "/as" },
  ]);

  assert.deepEqual(menu, [{ id: "as", name: "A/S", url: "/as" }]);
});

test("받은 배열을 건드리지 않는다", () => {
  const claim = [{ id: "as", name: "A/S", url: "/as" }];
  const before = JSON.stringify(claim);

  normalizeServiceMenu(claim);

  assert.equal(JSON.stringify(claim), before);
});
