import { BellBehavior } from "./BellBehavior";
import { isSafeNotificationHref } from "./normalize";
import { notificationToneIndex } from "./tone";
import type { NotificationBellItem } from "./types";

/**
 * 사내 시스템의 **알림 종**.
 *
 * 사내 시스템이 여럿인데(A/S · 포털 · 계측기 · 개선요청 · PO · 휴가) 종은
 * A/S 에만 있었다. 어느 시스템에 있든 종 하나를 열면 **모든 시스템의 알림**이
 * 보이게 하려고 묶음으로 뺐다. 목록을 합치는 일은 포털이 한다
 * (dss-auth 의 notifications/merge.ts) — 여기는 **받은 목록을 그리기만** 한다.
 *
 * ── 🔴 이 조각은 자료를 가져오지 않는다 ──────────────────────────────────
 * fetch 도, 포털 주소도, 로그인도, DB 도 모른다. 그래야 (1) 사이트마다 제
 * 방식으로 목록을 구해 넣을 수 있고 — 포털에 물어서든, 제 서버에서 세든 —
 * (2) 시험이 브라우저도 서버도 없이 돌고, (3) 이 묶음이 어느 사이트의 인증
 * 방식에도 묶이지 않는다. 실제로 그런지는 no-network.test.ts 가 이 폴더의
 * 소스를 읽어 못 박는다.
 *
 * ── 🔴 개수를 다시 세지 않는다 ───────────────────────────────────────────
 * 배지에 찍는 숫자는 **받은 값 그대로**다. 세는 규칙은 시스템마다 다르다 —
 * A/S 는 「같은 대상은 한 번만」 세고(그쪽 countNotificationTargets), 다른
 * 시스템은 다르게 셀 수 있다. 여기서 줄 수를 세면 각 시스템의 종과 이 종이
 * 서로 다른 숫자를 말하게 된다(포털이 같은 이유로 각 시스템이 센 값을 더하기만
 * 한다 — merge.ts).
 *
 * ── 서버 컴포넌트다("use client" 를 붙이지 않는다) ───────────────────────
 * 펼치고 접는 일은 <details> + <summary> 라 **브라우저가 스스로** 한다. 상태도
 * 이벤트 핸들러도 없으므로 이 파일은 서버 컴포넌트로 남고, 스크립트가 아직 안
 * 붙은 화면에서도 종을 열어 읽고 링크로 나갈 수 있다(사내망에서는 스크립트가
 * 늦게 붙는 일이 실제로 있다). 덤으로 **정적 렌더 시험**이 펼친 속까지 그대로
 * 볼 수 있다 — useState 로 여닫으면 시험에서는 늘 닫힌 종만 보인다.
 *
 * 🔴 곁들이는 BellBehavior 만이 "use client" 다. 그 조각은 **아무것도 그리지
 *    않고**(null), 바깥을 눌렀을 때·Esc 를 눌렀을 때 접는 일과 줄을 눌렀을 때
 *    사이트에 알리는 일만 얹는다 — 서버 컴포넌트가 클라이언트 조각을 그리는
 *    것은 막히지 않으므로 이 파일은 그대로 서버 컴포넌트다.
 *
 * ── next/link 를 쓰지 않는다 ─────────────────────────────────────────────
 * 알림은 **다른 앱(다른 포트/다른 호스트)** 으로 가는 주소를 들고 올 수 있다.
 * next/link 의 클라이언트 전환은 같은 앱 안에서만 뜻이 있고, 평범한 <a> 로
 * 두면 이 묶음이 next 에 의존하지 않아도 되며 시험도 next 없이 돈다.
 *
 * ── 스타일은 CSS 파일로 따로 온다 ────────────────────────────────────────
 * 여기서 `import "./notification-bell.css"` 를 하지 않는다. 그 한 줄이 있으면
 * 번들러 없이는 이 파일을 부를 수 없게 되어 node 로 돌리는 시험이 깨진다.
 * 사이트가 제 최상위 layout 에서 한 번 불러 준다(README 참조).
 *
 * Tailwind 유틸리티(`dark:` 포함)를 쓰지 않는 이유도 README 에 있다. 요약:
 * 사이트마다 다크를 켜는 방식이 다르고(A/S 는 `.dark` 클래스, 계측기는 라이트
 * 고정), Tailwind v4 는 node_modules 를 훑지 않아 묶음에서 건너간 클래스에는
 * 규칙 자체가 없다.
 */

/** 바깥에서 준 className 앞에 늘 서는 우리 클래스. */
const OWN_CLASS = "dss-bell";

/**
 * 밝기를 무엇에 맞출지. 메뉴바(ServiceMenuColorScheme)와 같은 네 값이고 뜻도
 * 같다 — 두 조각이 한 머리말에 나란히 앉으므로 사이트가 같은 말을 두 번 하게
 * 된다. 그래도 타입을 나눠 둔 것은 폴더끼리 서로를 부르지 않기 위해서다.
 *
 * - `"host"`(기본): 사이트를 따라간다. 조상에 `.dark` 나 `[data-theme="dark"]`
 *   가 있으면 어두워지고, 없으면 밝다.
 * - `"light"` / `"dark"`: 사이트가 어떻든 이 종만 고정한다.
 * - `"system"`: OS 설정(prefers-color-scheme)을 따른다. 사이트 전체가 그
 *   방식일 때만 고르라 — 아니면 종만 따로 놀게 된다.
 */
export type NotificationBellColorScheme = "host" | "light" | "dark" | "system";

export type NotificationBellProps = {
  /**
   * 그릴 알림 목록. **차례 그대로 그린다** — 시스템별로 이어 붙인 차례를
   * 포털이 이미 정해 두었고(merge.ts), 여기서 다시 섞으면 그 뜻이 사라진다.
   * readonly 인 이유: 이 조각이 목록을 건드리지 않는다는 약속이다.
   */
  items: readonly NotificationBellItem[];
  /**
   * 배지에 찍을 숫자. 🔴 **받은 값 그대로** 찍는다 — 다시 세지 않는다(위
   * 머리말). 0 이하이거나 숫자가 아니면 배지를 그리지 않는다.
   *
   * 🔴 그래서 **참말을 넣어야 한다.** 줄 수와 달라도 묶음은 고쳐 주지 않는다.
   */
  count: number;
  /**
   * 화면 낭독기가 읽을 이 종의 이름(기본 "알림"). 눈에는 보이지 않는다 —
   * 종은 아이콘 하나짜리 단추라 글자를 실을 자리가 없고, 이름이 없으면
   * 낭독기에 「단추」 하나로만 읽힌다.
   */
  label?: string;
  /** 밝기를 무엇에 맞출지. 위 NotificationBellColorScheme 참조. */
  colorScheme?: NotificationBellColorScheme;
  /**
   * 사이트가 바깥 여백·위치를 보탤 때. 이 묶음의 클래스 뒤에 붙으므로 사이트
   * 것이 이긴다(같은 우선순위면 나중에 적힌 규칙이 이긴다).
   */
  className?: string;
  /**
   * 줄을 눌렀을 때 사이트에 알린다. **이동은 이 함수와 무관하게** 평범한
   * <a href> 가 한다 — 여기서 던져도 이동은 그대로 간다.
   *
   * 🔴 **묶음은 서버를 모른다.** 「확인했다」를 어디에 적을지, 애초에 이 종류가
   *    눌러 확인하는 종류인지조차 여기서 정하지 않는다 — 그것은 그 알림을 만든
   *    시스템만 아는 것이다. 이 함수를 받은 사이트가 제 규칙으로 가려 적는다.
   *
   * ⚠️ 사이트의 **서버 컴포넌트**에서 이 종을 그린다면 여기 넘길 수 있는 것은
   *    서버 액션뿐이다(평범한 함수는 클라이언트 경계를 건너지 못한다). 클라이언트
   *    컴포넌트 안에서 그린다면 아무 함수나 된다 — README 7절.
   */
  onAcknowledge?: (item: NotificationBellItem) => void;
};

export function NotificationBell({
  items,
  count,
  label = "알림",
  colorScheme = "host",
  className,
  onAcknowledge,
}: NotificationBellProps) {
  // 그릴 수 없는 주소는 **그 줄만** 버린다(isSafeNotificationHref 주석).
  // 🔴 이 값은 남의 시스템에서 온 글자다 — 포털이 한 번 걸렀더라도 여기서 또
  //    본다. 값이 두 줄이라 양쪽에 두는 편이 싸다.
  const drawable = items.filter((item) => isSafeNotificationHref(item.href));

  // 목록이 비면 **아무것도 그리지 않는다** — 배지도, 빈 종도 남기지 않는다.
  //
  // 알림이 없는 것은 정상이고(사람은 대개 알림이 없다), 그때 할 일도 볼 것도
  // 없다. 빈 종을 남겨 두면 머리말에 「눌러도 아무것도 없는 단추」가 하나
  // 늘어나고, 사람은 그것을 눌러 보고서야 비었다는 것을 안다.
  //
  // ⚠️ 이것은 A/S 의 지금 종과 **다른 점**이다(그쪽은 빈 종도 그린다). 붙이는
  //    사이트가 이 차이를 알고 골라야 한다 — README 7절에 적어 두었다.
  if (drawable.length === 0) return null;

  // 배지는 받은 숫자 그대로. 숫자가 아니거나 0 이하면 그리지 않는다 — "0" 이라고
  // 적힌 배지는 할 일이 있는 것처럼 눈에 띄기만 한다.
  const badge = Number.isFinite(count) && count > 0 ? count : null;

  // 낭독기에 읽히는 이름. 개수까지 읽혀야 열어 보지 않고도 안다.
  const name = badge === null ? label : `${label} ${badge}건`;

  const ownClasses = className ? `${OWN_CLASS} ${className}` : OWN_CLASS;

  return (
    // 🔴 <details> 인 이유: 펼치고 접는 일을 **브라우저가** 한다. <summary> 는
    // 낭독기에 단추로 읽히고 펼침 여부(aria-expanded)도 브라우저가 붙여 준다.
    <details className={ownClasses} data-color-scheme={colorScheme}>
      <summary className="dss-bell__summary">
        <svg
          className="dss-bell__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {badge !== null && (
          // aria-hidden 인 까닭: 바로 아래 이름이 이미 "알림 3건"으로 읽힌다.
          // 두 번 읽히면 낭독기에서 "3 알림 3건"이 된다.
          <span className="dss-bell__badge" aria-hidden="true">
            {badge}
          </span>
        )}
        {/* 🔴 이름은 마크업에 늘 남는다 — CSS 가 눈에서만 감춘다(clip).
            지우면 이 단추가 낭독기에 아무 이름 없이 읽힌다. */}
        <span className="dss-bell__label">{name}</span>
      </summary>

      <ul className="dss-bell__list">
        {drawable.map((item, index) => {
          // 종류 이름이 비어 오는 일이 실제로 있다(보낸 쪽이 안 실었을 때 —
          // 포털은 빈 문자열로 채워 보낸다). 그때는 그 줄만 안 그린다.
          const hasKind = item.kindLabel !== "";
          const hasSource = item.sourceName !== "";
          const hasDetail = item.detail !== "";

          return (
            // key 에 차례를 섞는다. 열쇠가 겹친 목록이 들어와도 React 가
            // 경고를 쏟지 않게 하기 위한 것이다.
            <li className="dss-bell__item" key={`${index}-${item.key}`}>
              <a
                className="dss-bell__link"
                // 🔴 **받은 그대로** 나간다. 앞에 무엇도 붙이지 않는다.
                href={item.href}
                // 눌린 줄이 어느 줄인지 알아내는 열쇠(BellBehavior). 마크업에
                // 실어 두면 그 조각이 목록을 다시 훑지 않아도 된다.
                data-notification-key={item.key}
                data-source-id={item.sourceId}
              >
                {(hasKind || hasSource) && (
                  <span className="dss-bell__meta">
                    {hasKind && (
                      // 🔴 색은 CSS 가 이 숫자로 고른다(tone.ts). 클래스 이름을
                      // 조립하지 않는 이유는 Tailwind 와 같은 함정 때문이 아니라
                      // (여기는 우리 CSS 다) 규칙이 한 곳에 모여 있어야 다크에서
                      // 빠진 색을 시험이 잡을 수 있어서다.
                      <span className="dss-bell__kind" data-tone={notificationToneIndex(item.kind)}>
                        {item.kindLabel}
                      </span>
                    )}
                    {hasSource && <span className="dss-bell__source">{item.sourceName}</span>}
                  </span>
                )}
                <span className="dss-bell__line">
                  <span className="dss-bell__subject">{item.subject}</span>
                  {hasDetail && (
                    <>
                      <span className="dss-bell__separator" aria-hidden="true">
                        ·
                      </span>
                      <span className="dss-bell__detail">{item.detail}</span>
                    </>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {/* 🔴 아무것도 그리지 않는다(null). 바깥을 눌렀을 때·Esc 를 눌렀을 때
          접는 일과, 줄을 눌렀을 때 사이트에 알리는 일만 얹는다 — 마크업은 한
          글자도 늘지 않고, 스크립트가 없으면 그 셋만 없다(BellBehavior). */}
      <BellBehavior items={drawable} onAcknowledge={onAcknowledge} />
    </details>
  );
}
