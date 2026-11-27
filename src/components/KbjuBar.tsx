import type { Kbju } from '../types';
import { formatKbju } from '../lib/nutrition';

interface Props {
  total: Kbju;
  portions?: number;
}

export function KbjuBar({ total, portions }: Props) {
  const mult = portions && portions > 0 ? portions : 1;
  return (
    <div className="kbju-bar">
      <div className="kbju-chip">
        <div className="v">{Math.round(total.calories * mult)}</div>
        <div className="l">ккал</div>
      </div>
      <div className="kbju-chip">
        <div className="v">{formatKbju(total.protein * mult)} г</div>
        <div className="l">белки</div>
      </div>
      <div className="kbju-chip">
        <div className="v">{formatKbju(total.fat * mult)} г</div>
        <div className="l">жиры</div>
      </div>
      <div className="kbju-chip">
        <div className="v">{formatKbju(total.carbs * mult)} г</div>
        <div className="l">углеводы</div>
      </div>
    </div>
  );
}