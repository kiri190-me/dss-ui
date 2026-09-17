# @dss/ui — 사내 시스템이 함께 쓰는 화면 조각

지금 들어 있는 것은 **서비스 오가기 메뉴바** 하나다.

직원은 하루에도 A/S · 계측기 · 개선요청을 여러 번 옮겨 다니는데, 지금은 그때마다
포털(`/apps`)로 돌아갔다 와야 한다. 이 띠가 각 사이트 머리말 위에 앉아 한 번에
건너뛰게 한다. 사이트가 다섯이 될 예정이라 같은 코드를 다섯 벌 두지 않으려고
묶음으로 뺐다.

```
dss-ui/
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ eslint.config.mjs
├─ .gitignore
├─ README.md
└─ src/
   ├─ index.ts                       ← 밖으로 내보내는 것 전부
   └─ service-menu/
      ├─ types.ts                    ← 받는 자료의 모양(포털 클레임의 거울)
      ├─ normalize.ts                ← 토큰에서 꺼낸 값을 거르는 문지기
      ├─ ServiceMenuBar.tsx          ← 띠 자체
      ├─ service-menu.css            ← 생김새(라이트 · 다크 · 인쇄)
      ├─ ServiceMenuBar.test.tsx
      ├─ normalize.test.ts
      ├─ service-menu.css.test.ts
      └─ no-network.test.ts
```

---

## 1. 이 묶음이 하지 않는 것

🔴 **자료를 가져오지 않는다.** fetch 도, 포털 주소도, 로그인도, DB 도 모른다.
받은 목록을 그리기만 한다.

그래야

- 사이트마다 제 방식으로 목록을 구해 넣을 수 있고(세션에서든 토큰에서든),
- 이 묶음이 어느 사이트의 인증 방식에도 묶이지 않고,
- 시험이 브라우저도 서버도 DB 도 없이 돈다.

`no-network.test.ts` 가 이 폴더의 소스를 읽어 **실제로 그런지** 못 박는다 —
바깥 모듈 호출, `fetch(`·`XMLHttpRequest` 같은 이름, 박힌 주소, `process.env`
를 전부 찾아 막는다.

🔴 **권한을 판정하지 않는다.** 목록에 없는 것을 더하지 않고, 누가 어디에 들어갈
수 있는지 따지지 않는다. 그건 포털만 아는 것이고(`dss-auth` 의
`listAccessibleClients`), 판정이 두 벌이 되면 포털 타일과 메뉴바가 서로 다른
말을 하게 된다.

---

## 2. 받는 자료 — 포털이 토큰에 싣는 모양 그대로

```ts
type ServiceMenuEntry = {
  id: string;     // 포털의 clients.client_id
  name: string;   // 포털 타일(/apps)에 뜨는 것과 같은 이름
  url: string;    // {lan} 까지 펼쳐진 완성된 주소
  icon?: string;  // 이모지. 없으면 **키 자체가 없다**
};
```

원본은 `dss-auth/src/lib/oidc/service-menu.ts` 의 `ServiceMenuEntry` 이고,
포털이 로그인 ID 토큰의 **`dss_services`** 클레임에 싣는 한 칸의 모양이다.
이름·선택성(`icon` 만 `?`)을 **글자 하나까지** 맞춰 두었다. 사이트는 토큰에서
꺼낸 배열을 옮겨 담지 않고 그대로 넘기면 된다 — 옮겨 담는 코드가 생기는 순간
그것이 다섯 벌이 되고, 이 묶음을 만든 이유가 사라진다.

저장소가 서로 독립이라 그 타입을 `import` 할 수는 없어 베껴 적었다. 저쪽이 칸을
**늘리면** 여기는 그대로 두어도 되고(구조적 타입이라 통과한다), 이름을 바꾸거나
칸을 **빼면** 사이트에서 컴파일이 깨진다. 그때 고칠 곳은 `types.ts` 하나다.

### 쓰는 법

```tsx
import { ServiceMenuBar, normalizeServiceMenu } from "@dss/ui";

// 토큰/세션에서 꺼낸 값(타입이 없는 값)이라면 한 번 거른다.
const services = normalizeServiceMenu(claims.dss_services);

<ServiceMenuBar services={services} currentServiceId={MY_CLIENT_ID} />;
```

| prop | 뜻 |
|---|---|
| `services` | 그릴 목록. **받은 차례 그대로** 그린다. 비면 아무것도 그리지 않는다 |
| `currentServiceId` | 이 사이트의 `client_id`(= ID 토큰의 `aud`). 그 칸이 눌린 상태가 된다 |
| `label` | 화면 낭독기가 읽을 띠 이름(기본 "사내 시스템 바로가기") |
| `colorScheme` | `"host"`(기본) · `"light"` · `"dark"` · `"system"` — 4절 |
| `className` | 사이트가 바깥 여백·위치를 보탤 때 |

`normalizeServiceMenu` 는 **모양만** 본다: `id`·`name`·`url` 이 빈 칸을 버리고,
링크로 그릴 수 없는 주소(`javascript:` · `data:` · `//host`)를 버리고, 너무 긴
아이콘은 아이콘만 버리고, 겹친 `id` 는 먼저 온 것만 남긴다. 차례는 손대지
않는다.

---

## 3. 어디에 앉히나 — 각 사이트 머리말과의 관계

**머리말 "위"에 독립된 띠로 앉힌다.** 머리말 "안"에 끼우지 않는다.

이유: 다섯 사이트의 머리말이 구조가 제각각이다. A/S 는 햄버거 + 제목 + 알림종이
한 줄에 든 `flex`(폰 360px 에서 넘치지 않으려고 오른쪽에 아이콘 하나만 두기로
못 박아 둔 자리다 — `TopBar.tsx` 주석), 계측기는 항목이 줄바꿈되는 `flex-wrap`,
개선요청은 좌우 두 덩이다. 여기에 칸이 다섯~열 개 붙는 목록을 끼워 넣으면
사이트마다 다른 방식으로 깨진다. 위에 별도 띠로 앉히면 **사이트 머리말을 한 줄도
고치지 않는다.**

덤으로 생김새의 은유가 맞아떨어진다: 띠는 머리말보다 한 단 눌린 바탕이고, 지금
있는 서비스만 머리말과 같은 색으로 떠 있다 — 브라우저 탭과 같은 읽는 법이라
설명이 필요 없다.

| 사이트 | 넣을 자리 | 목록을 구하는 곳 |
|---|---|---|
| RF_Service_System (A/S) | `src/components/layout/AppShell.tsx` 최상위 `<div>` 안, `<TopBar>` 를 감싼 `print:hidden` 블록 **바로 위** | `src/app/(app)/layout.tsx` 가 서버에서 풀어 AppShell prop 으로 내린다(`portalUrl` 을 이미 그렇게 내려보내고 있다) |
| njlee (계측기) | `src/app/(internal)/layout.tsx` 의 `<AppHeader …/>` 바로 위 | 같은 layout 이 서버에서 |
| dss-improvements (개선요청) | `src/app/(internal)/layout.tsx` 계열의 `<AppHeader …/>` 바로 위 | 같은 layout 이 서버에서 |
| dss-auth (포털) | **넣지 않는다** — 그 자체가 목록이다 | — |
| dss-home · synergy-attendance | 아직 안 봤다. 고객용 화면에는 사내 메뉴가 나가면 안 되므로 **넣을지부터** 정해야 한다 | — |

### 붙일 때 챙길 것

- **스타일시트 한 줄.** 사이트 최상위 `layout.tsx`(또는 `globals.css` 를 부르는
  곳)에서 `import "@dss/ui/styles.css";` 를 한 번 한다. 이 조각은 CSS 를 스스로
  부르지 않는다 — 그러면 번들러 없이는 부를 수 없게 되어 시험이 깨진다.
- **A/S 의 노치 인셋.** `TopBar` 가 `pt-[env(safe-area-inset-top)]` 를 갖고
  있다(`viewport-fit=cover` 때문). 띠가 그보다 위에 앉으면 인셋을 **띠로 옮겨야**
  한다:
  `.dss-menu { --dss-menu-inset-top: env(safe-area-inset-top); }` 를 켜고
  `TopBar` 에서는 뺀다. 둘 다 두면 노치 높이만큼 두 번 밀린다.
- **줄지 않게.** 세로 `flex` 안에 넣을 때는 `className="shrink-0"` 을 준다.
- **인쇄.** CSS 가 `@media print` 로 스스로 감춘다. 사이트 쪽 `print:hidden` 을
  또 걸 필요 없다(걸어도 해롭지 않다).
- **로그인 전 화면에는 넣지 않는다.** 목록이 없으면 어차피 아무것도 안 그리지만,
  로그인 화면 위에 회색 띠 자리만 생기지 않게 보호 구간 layout 안에 둔다.

---

## 4. 다크 모드

사이트마다 다크를 켜는 방식이 다르다. 실제로 이렇다:

- `RF_Service_System` : `@custom-variant dark (&:where(.dark, .dark *))` — **클래스**로 켠다.
  `ThemeToggle.tsx` 가 `document.documentElement.classList.toggle("dark", …)` 로
  `<html>` 에 건다(「시스템 설정 따름」도 JS 에서 계산해 결국 이 클래스가 된다).
  그래서 A/S 에서는 `colorScheme` 을 건드릴 필요가 없다 — 기본값이 맞다.
- `njlee` : 다크 변형이 없고 `color-scheme: light` 로 **라이트 고정**이다.

그래서 이 묶음은 Tailwind 의 `dark:` 유틸리티를 **쓰지 않는다.** 썼다면 Tailwind
기본값인 `prefers-color-scheme` 이 적용되어, 계측기에서 OS 가 어두운 사람에게만
**이 띠 하나만** 까맣게 뜬다. (게다가 Tailwind v4 는 `node_modules` 안을 훑지
않으므로 유틸리티로 짜면 사이트마다 `@source` 한 줄을 또 넣어야 한다. 어차피 한
줄 넣을 거라면 그 한 줄이 CSS import 인 편이 낫다 — 번들러도 프레임워크도 안 탄다.)

대신 색을 전부 CSS 변수로 두고 **네 가지 신호**를 받는다:

| `colorScheme` | 어두워지는 조건 |
|---|---|
| `"host"` (기본) | 조상에 `.dark` 또는 `[data-theme="dark"]` 가 있을 때 |
| `"dark"` / `"light"` | 사이트가 어떻든 이 띠만 고정 |
| `"system"` | OS 설정(`prefers-color-scheme`) |

기본값이 `"host"` 라서 A/S(클래스 방식)와 계측기(라이트 고정)가 **둘 다 그대로
옳게** 나온다. 사이트가 제 색으로 맞추고 싶으면 변수만 덮으면 된다:

```css
.dss-menu {
  --dss-menu-bg: #f8fafc;
  --dss-menu-accent: #0f172a;
}
```

라이트에 있는 색은 다크에도 **전부** 있어야 한다(한쪽만 빠지면 그 색만 반대 모드
값을 물려받아 글자가 바탕에 묻는다). `service-menu.css.test.ts` 가 두 벌을 맞대
대조한다.

---

## 5. 🔴 사이트가 이 묶음을 어떻게 가져다 쓰나 — 정해야 할 것

저장소 다섯이 각자 독립이고 도커로 따로 빌드한다. **지금은 저장소끼리 코드를
공유하는 구조가 아예 없다.** 그래서 묶음을 만든 것만으로는 부족하고, 사이트가
이것을 어떻게 받아 오는지를 정해야 한다.

각 사이트의 Dockerfile 은 `COPY . .` — **빌드 맥락이 그 저장소 폴더 하나**다.
옆 폴더(`../dss-ui`)는 이미지 안으로 들어가지 않는다. 이 한 줄이 아래 선택지의
값을 거의 다 결정한다.

### 길 비교

| | 새로 만들 것 | 도커 빌드 변화 | 코드 벌 수 | 값(비용) |
|---|---|---|---|---|
| **ㄱ. 소스 복사 + 맞춤 스크립트** | 복사 스크립트 하나, 각 사이트에 `src/components/dss-ui/`, 드리프트 검사 시험 | 없음 | **다섯 벌** | 가장 단순하지만 **복사본이 다섯 벌 남는다** — 이번에 안 하기로 한 바로 그것 |
| **ㄴ. git submodule** ⭐ | `dss-ui` 를 저장소로 만들고 원격에 올린다. 각 사이트에 `.gitmodules` + `vendor/dss-ui`, `tsconfig.paths` 별칭 한 줄, eslint 무시 한 줄 | **없음** — 체크아웃되어 있으면 `COPY . .` 가 같이 담는다 | **한 벌** | 서브모듈 의식: 클론할 때 `--recurse-submodules`, 묶음을 먼저 올리고 사이트의 포인터 커밋을 따로 올려야 한다 |
| **ㄷ. npm 꾸러미 파일(tgz) 고정** | `npm pack` 산출물을 각 사이트 `vendor/` 에 두고 `"@dss/ui": "file:vendor/…tgz"`, `next.config` 에 `transpilePackages` | 없음(꾸러미가 맥락 안에 있어 `npm ci` 가 오프라인으로 깐다) | 한 벌 + 꾸러미 다섯 | 고칠 때마다 pack → 다섯 곳에 **바이너리 파일 교체 커밋**. 무엇이 바뀌었는지 diff 로 안 보인다 |
| **ㄹ. 사내 npm 레지스트리(NAS)** | NAS 에 레지스트리 서비스(Verdaccio 등) + 계정 + 백업 대상 하나 + 사이트마다 `.npmrc` | 빌드가 레지스트리에 **닿아야** 한다 | 한 벌 | 가장 '제대로'지만 **운영할 서비스가 하나 는다.** 그것이 죽으면 다섯 사이트의 빌드가 함께 멈춘다 |
| **ㅁ. 모노레포로 합치기** | 다섯 저장소 통합, 배포 파이프라인 전면 재작성 | 전면 | 한 벌 | 지금 할 일이 아니다 |

### 추천: **ㄴ. git submodule**

이유:

1. **코드가 한 벌이다.** 이번 결정("복사본 다섯 벌은 안 둔다")을 실제로 지키는
   길은 ㄴ·ㄷ·ㄹ 셋뿐이다.
2. **도커가 안 바뀐다.** 서브모듈은 저장소 폴더 **안**에 체크아웃되므로
   `COPY . .` 가 이미 담아 간다. Dockerfile 도, `npm ci` 도, `.dockerignore` 도
   손대지 않는다.
3. **운영할 것이 늘지 않는다.** NAS 에 새 서비스를 띄우지 않는다(ㄹ 과의 차이).
   사내망이 끊겨도 빌드된다.
4. **사이트마다 언제 따라갈지 고른다.** 서브모듈은 커밋 SHA 로 고정된다. 띠를
   고쳐도 A/S 만 먼저 올려 보고, 나머지 넷은 다음 배포 때 따라가면 된다 —
   다섯이 한꺼번에 흔들리지 않는다. 이 회사처럼 사이트마다 배포 주기가 다른
   곳에서는 이게 가장 큰 값이다.
5. **번들러 설정이 필요 없다.** 저장소 안의 소스라 Next 가 제 앱 코드처럼
   컴파일한다 — `transpilePackages` 도, Tailwind `@source` 도 필요 없다
   (ㄷ 과의 차이).

맞바꾸는 것(솔직히):

- 서브모듈은 익히기 전에는 헷갈린다. **묶음을 먼저 올리고, 그 다음에 사이트의
  포인터 커밋을 올린다** — 순서를 바꾸면 남의 컴퓨터에서 체크아웃이 안 된다.
- 새로 클론할 때 `git clone --recurse-submodules` 를 잊으면 `vendor/dss-ui` 가
  빈 폴더가 된다. 그때는 **빌드가 크게 실패한다**(조용히 옛 코드가 쓰이지는
  않는다) — 헷갈리지만 위험하지는 않은 실패다.
- 이 길을 고르려면 먼저 `dss-ui` 를 git 저장소로 만들고 원격에 올려야 한다.
  **이번 조각에서는 하지 않았다**(지시에 따라 `git init` 하지 않았다).

**ㄷ(tgz) 는 좋은 차선이다.** 서브모듈 의식이 실제로 성가시게 굴면 갈아타면
된다 — 고쳐야 할 것은 각 사이트의 `package.json` 한 줄과 `next.config` 한 줄뿐,
이 묶음의 코드는 그대로다. **ㄹ(사내 레지스트리)** 은 공유 조각이 여럿이 되고
사이트마다 다른 판을 써야 할 때 가는 곳이지, 조각 하나에 서비스를 하나 띄울
일은 아니다.

> 어느 길이든 **이번 조각에서는 실행하지 않았다.** 사이트에 붙이는 것은 다음
> 조각이고, 그때 사람이 위에서 고른다.

---

## 6. 시험

```bash
npm install
npx tsc --noEmit
npm run lint
npm test
```

`npm test` 는 `node --test` 로 돈다(새 시험 라이브러리를 들이지 않았다 — 사이트
저장소들과 같은 방식이다). 브라우저도 jsdom 도 쓰지 않고 `react-dom/server` 로
**진짜로 그려** 나온 마크업을 확인한다.

시험이 못 박는 것:

- 목록이 비어도(권한이 없거나 아직 못 받았거나) 죽지 않고 **빈 띠도 남기지 않는다**
- 지금 있는 서비스 **한 칸만** 눌린 상태가 된다 — 모르는 id 를 넘겨도 죽지 않는다
- **받은 차례 그대로** 그린다
- 🔴 **망을 타지 않는다** — 바깥 모듈도, 박힌 주소도, 환경변수도 없다
- 다크에 라이트의 색이 하나도 빠지지 않았다
- 마크업이 쓰는 클래스에 규칙이 다 있다(그 반대도)
- 서비스가 열로 늘어도 그려지고, 좁은 화면에서는 띠 안에서만 굴러간다
