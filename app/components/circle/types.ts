import type { CircleView } from "../../../server/lib/view";

export type View = CircleView;
export type ViewMember = CircleView["members"][number];
export type ViewRound = CircleView["rounds"][number];

export function memberMap(view: View) {
  return new Map(view.members.map((m) => [m.id, m]));
}
