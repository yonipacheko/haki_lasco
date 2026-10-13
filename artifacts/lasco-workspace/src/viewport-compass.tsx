import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Quaternion, type Camera } from 'three';
import { projectCompass } from './compass-projection';
import './viewport-compass.css';

export type ViewportCompassHandle = { update: (camera: Camera) => void };

export const ViewportCompass = forwardRef<ViewportCompassHandle>(function ViewportCompass(_, ref) {
  const groups = useRef<(SVGGElement | null)[]>([]);
  const previous = useRef<Quaternion | null>(null);
  const rotation = useRef(new Quaternion());
  useImperativeHandle(ref, () => ({
    update(camera) {
      camera.getWorldQuaternion(rotation.current);
      if (previous.current && previous.current.angleTo(rotation.current) < .00001) return;
      previous.current = rotation.current.clone();
      for (const [index, point] of projectCompass(rotation.current).entries()) {
        const group = groups.current[index];
        if (!group) continue;
        const x = 50 + point.dx * 22, y = 50 + point.dy * 22;
        group.querySelector('line')?.setAttribute('x2', String(x));
        group.querySelector('line')?.setAttribute('y2', String(y));
        group.querySelector('path')?.setAttribute('d', `M ${x} ${y} L ${x - point.dx * 6 - point.dy * 3} ${y - point.dy * 6 + point.dx * 3} L ${x - point.dx * 6 + point.dy * 3} ${y - point.dy * 6 - point.dx * 3} Z`);
        group.querySelector('.compass-label')?.setAttribute('transform', `translate(${point.labelX} ${point.labelY})`);
        group.dataset.screenDirection = `${point.dx.toFixed(5)},${point.dy.toFixed(5)}`;
      }
    },
  }), []);

  return (
    <div className="viewport-compass" data-testid="viewport-compass" role="img" aria-label="Project orientation compass: North, East, South and West. Project reference, not geographic North." title="Project orientation · reference directions, not geographic North">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="compass-ring" cx="50" cy="50" r="22" />
        {projectCompass(new Quaternion()).map((point, index) => (
          <g key={point.label} className={`compass-direction ${point.label === 'N' ? 'compass-north' : ''}`} data-direction={point.name} ref={node => { groups.current[index] = node; }}>
            <line x1="50" y1="50" x2={50 + point.dx * 22} y2={50 + point.dy * 22} />
            <path />
            <g className="compass-label" transform={`translate(${point.labelX} ${point.labelY})`}>
              {point.label === 'N' && <circle r="14" />}
              <text textAnchor="middle" dominantBaseline="central">{point.label}</text>
            </g>
          </g>
        ))}
        <circle className="compass-center" cx="50" cy="50" r="2" />
      </svg>
      <span>Project orientation</span>
    </div>
  );
});
