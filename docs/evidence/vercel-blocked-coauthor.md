# 배포가 13일간 조용히 멈춰 있었다 — 원인은 커밋의 공동 작성자

- **날짜**: 2026-09-16
- **증상 기간**: 2026-09-04 ~ 09-16 (커밋 11건이 배포 안 됨)
- **관련**: `docs/일정.md` "금요일마다 배포 URL 에서 직접 눌러본다"

---

## 무슨 일이 있었나

9/16 에 배포 URL 을 확인하다가 발견했다.

```
배포된 /quality      8월의 껍데기 ("M11에서 GROUP BY + 누적 비율 쿼리를 붙인다")
배포된 /lots/[lotId] 샷 이력 없음
recharts             어느 화면에도 없음
```

현재 production 이 `d6d26a0` (9/2) 였다. **그 뒤 커밋이 하나도 안 올라갔다.**

## 원인

Vercel Deployments **목록**을 보니 9/4 이후 전부 `Blocked` 였다.

```
The deployment was blocked because the commit author did not have
contributing access to the project on Vercel.
Hobby teams do not support collaboration.
```

원인은 커밋 메시지의 트레일러였다.

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

`noreply@anthropic.com` 은 어떤 Vercel 계정에도 없다. Vercel 이 이를 **"다른 사람과의
협업"** 으로 판정했고, **Hobby 플랜은 협업을 지원하지 않아** 빌드를 시작조차 안 했다.

## 증명

같은 작성자·같은 브랜치·같은 코드에서 트레일러 유무만 다르게 해봤다.

| 커밋 | `Co-Authored-By` | 결과 |
|---|---|---|
| `fc1fc3f` | 있음 | **Blocked** |
| `46a922e` | 없음 | **Ready (27초)** |

변수 하나만 바꿔 확인했다. 원인 확정.

## 왜 9/2 에는 됐나

`d6d26a0` (9/2, 배포 성공) 에도 같은 트레일러가 있었다.
**Vercel 이 9/3~9/4 사이에 검사를 강화한 것으로 보인다.** 우리 쪽에서 바뀐 건 없다.

🔴 **"어제 됐으니 오늘도 된다"가 성립하지 않는다.** 외부 서비스는 말없이 규칙을 바꾼다.

## 조치

- 이 저장소에서는 커밋에 `Co-Authored-By` 를 넣지 않는다
- 이 저장소의 `user.email` 을 `herobeomjun@gmail.com` 으로 설정 (Vercel 인증 계정)
  — 전역 설정(`deepintocoder@naver.com`)은 그대로 둔다

---

## 배운 것

**`Blocked` 는 `Error` 가 아니다.**

| 상태 | 뜻 | 로그 |
|---|---|---|
| `Error` | 빌드가 깨짐 — 우리 코드 문제 | 있음 |
| `Skipped` | 변경이 없어 건너뜀 — 설정 문제 | 있음 |
| **`Blocked`** | **빌드를 시작조차 안 함 — 계정 문제** | **없음** |

로그가 없어서 실패한 줄도 몰랐다.

**배포 상세 화면 하나만 보면 안 된다.** 거기는 "현재 production" 만 보여준다.
`Ready Stale` 이라고 적혀 있었는데 — *"현재 production 인데 브랜치에 더 새 커밋이 있다"* 는
뜻이다. **Deployments 목록**을 봐야 실패한 시도들이 보인다.

**진단 순서를 틀렸다.** 사용량 → 이메일 → 저장소 공개 → 팀 주인 순으로 헤맸다.
배포 문제는 **"누가 배포하는가"** 부터 봐야 한다. 계정·작성자 구조가 먼저다.

**규칙을 만들고 안 지켰다.** `docs/일정.md` 에 *"금요일마다 배포 URL 에서 직접
눌러본다. 로컬에서만 되는 건 된 게 아니다"* 라고 써놓고 9/11 에 안 했다.
**13일치를 놓쳤다.** 10월까지 갔으면 "MVP 완성" 이라고 말할 뻔했다.

🔴 **푸시했다 ≠ 배포됐다.**
