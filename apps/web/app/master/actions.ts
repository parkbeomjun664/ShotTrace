"use server";   // 🔴 1행 — 마스터 사용 중지 켜고 끄기 (019) · 추가 · 수정 (028 · 10/26)

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getMyRole } from "@/lib/queries";
import { createSessionClient } from "@/lib/supabase/session";

export async function setActive(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  const active = formData.get("active") === "true";   // 폼 값은 글자 — "true" 와 비교해 boolean 으로
  if ((await getMyRole()) !== "admin") redirect("/master?denied=1");   // 🔵 보내기 전에 막는다 — RLS(update_admin)는 마지막 문 (10/26)

  const supabase = await createSessionClient();
  const table = formData.get("table");                 // 🔴 표 이름은 폼에서 받지 않는다 — 비교만 하고 코드에 직접 적는다
  const { data, error } =
    table === "defect_code" ? await supabase.from("defect_code").update({ active }).eq("reason", key).select("reason")
    : table === "equipment" ? await supabase.from("equipment").update({ active }).eq("equip_cd", key).select("equip_cd")
    : table === "product" ? await supabase.from("product").update({ active }).eq("product_id", Number(key)).select("product_id")
    : await supabase.from("downtime_reason").update({ active }).eq("code", key).select("code");   // select = 고친 줄을 돌려받는다

  if (error) throw error;
  if (data.length === 0) redirect("/master?denied=1"); // 🔴 RLS 에 막힌 UPDATE 는 에러 없이 0줄 — 직접 확인한다 · redirect 는 던진다
  revalidatePath("/master");
}

// ── 추가 · 수정 (028) — 표마다 검문소 하나. 코드(키)는 추가할 때만 받고 수정에서는 바꾸지 않는다 ──
const text = (label: string) => z.string().trim().min(1, { error: `${label}을(를) 넣으세요` });
const Schemas = {
  equipment: z.object({
    equip_cd: text("코드"),
    equip_name: text("이름"),
    tonnage: z.union([z.literal("").transform(() => null), z.coerce.number().int().positive({ error: "톤수는 양의 정수로" })]),
  }),
  product: z.object({
    part_name: text("품명"),
    car_model: z.string().trim().transform((v) => v || null),
    side: z.union([z.literal("").transform(() => null), z.enum(["LH", "RH"], { error: "LH · RH 중 하나" })]),
    std_cycle_sec: z.coerce.number({ error: "표준 CT 는 숫자로" }).positive({ error: "표준 CT 는 0 보다 커야 해요" }),
  }),
  downtime_reason: z.object({
    code: text("코드").regex(/^[A-Z_]+$/, { error: "코드는 영문 대문자와 _ 만" }),
    name: text("이름"),
    planned: z.enum(["true", "false"]).transform((v) => v === "true"),
  }),
  defect_code: z.object({ reason: text("사유") }),
  parameter_spec: z.object({
    value: z.coerce.number({ error: "숫자로 넣으세요" }).positive({ error: "0 보다 커야 해요" }),
  }),
} as const;
type Table = keyof typeof Schemas;
const KEY: Record<Table, string> = { equipment: "equip_cd", product: "product_id", downtime_reason: "code", defect_code: "reason", parameter_spec: "metric" };

export type MasterState = { ok: boolean; message: string } | null;

export async function saveMaster(_prev: MasterState, formData: FormData): Promise<MasterState> {
  const table = String(formData.get("table")) as Table;
  if (!(table in Schemas)) return { ok: false, message: "알 수 없는 표예요" };
  const key = String(formData.get("key") ?? "");      // 수정이면 그 줄의 키 · 추가면 ""
  const fields = Object.fromEntries([...formData.entries()].filter(([k]) => !["table", "key"].includes(k) && !k.startsWith("$")));   // $ACTION… 은 Next 가 붙인 칸
  const parsed = Schemas[table].safeParse(fields);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  if ((await getMyRole()) !== "admin") return { ok: false, message: "admin 계정만 바꿀 수 있어요" };   // 보내기 전에 — RLS 는 마지막 문

  const supabase = await createSessionClient();
  const row = parsed.data as Record<string, unknown>;
  const editing = key !== "";
  if (editing) for (const k of ["equip_cd", "code", "reason"]) delete row[k];   // 🔴 키는 수정하지 않는다 — 가리키는 기록이 있다
  // 표 이름은 위의 Schemas 로 걸렀다 — 폼 글자를 그대로 쓰지 않는다
  const q = editing
    ? supabase.from(table).update(row as never).eq(KEY[table], table === "product" ? Number(key) : key).select()
    : supabase.from(table).insert(row as never).select();
  const { data, error } = await q;

  if (error?.code === "23505") return { ok: false, message: "이미 있는 코드 · 이름이에요" };   // PK · UNIQUE
  if (error?.code === "42501") return { ok: false, message: "admin 계정만 바꿀 수 있어요" };
  if (error) {
    console.error(error);
    return { ok: false, message: "저장하지 못했어요. 잠시 뒤 다시 해보세요" };
  }
  if (!data || data.length === 0) return { ok: false, message: "admin 계정만 바꿀 수 있어요" };   // RLS 에 막힌 UPDATE 는 0줄

  revalidatePath("/master");
  if (table === "product" || table === "parameter_spec") revalidatePath("/oee");   // 표준 CT · 허용 폭은 다른 화면의 계산에 쓰인다
  return { ok: true, message: editing ? "수정했어요" : "추가했어요" };
}
