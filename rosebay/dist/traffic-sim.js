const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const wrap = (value, length) => ((value % length) + length) % length;

export function makeRoute(points) {
  const distances = [0];
  for (let index = 1; index < points.length; index++) {
    distances.push(distances[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].z - points[index - 1].z));
  }
  return { points, distances, length: distances.at(-1) };
}

export function sampleRoute(route, distance, direction = 1, lane = 1.28) {
  const along = wrap(distance, route.length);
  let low = 0, high = route.distances.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (route.distances[middle] <= along) low = middle;
    else high = middle;
  }
  const start = route.points[low], end = route.points[high];
  const span = route.distances[high] - route.distances[low];
  const fraction = span ? (along - route.distances[low]) / span : 0;
  const tangentX = (end.x - start.x) / (span || 1);
  const tangentZ = (end.z - start.z) / (span || 1);
  return {
    x: start.x + (end.x - start.x) * fraction + tangentZ * lane * direction,
    z: start.z + (end.z - start.z) * fraction - tangentX * lane * direction,
    angle: Math.atan2(tangentX * direction, tangentZ * direction),
  };
}

export function overlaps(first, second, margin = 0) {
  const radius = Math.hypot(first.width, first.length) / 2 + Math.hypot(second.width, second.length) / 2 + margin;
  if ((second.x - first.x) ** 2 + (second.z - first.z) ** 2 >= radius * radius) return false;
  const firstForward = { x: Math.sin(first.angle), z: Math.cos(first.angle) };
  const secondForward = { x: Math.sin(second.angle), z: Math.cos(second.angle) };
  const firstRight = { x: firstForward.z, z: -firstForward.x };
  const secondRight = { x: secondForward.z, z: -secondForward.x };
  for (const axis of [firstForward, firstRight, secondForward, secondRight]) {
    const separation = Math.abs((second.x - first.x) * axis.x + (second.z - first.z) * axis.z);
    const firstRadius = Math.abs(firstForward.x * axis.x + firstForward.z * axis.z) * first.length / 2 + Math.abs(firstRight.x * axis.x + firstRight.z * axis.z) * first.width / 2;
    const secondRadius = Math.abs(secondForward.x * axis.x + secondForward.z * axis.z) * second.length / 2 + Math.abs(secondRight.x * axis.x + secondRight.z * axis.z) * second.width / 2;
    if (separation >= firstRadius + secondRadius + margin) return false;
  }
  return true;
}

export function signalPhase(time, offset = 0) {
  const phase = wrap(time + offset, 22);
  return phase < 12 ? 'green' : phase < 14 ? 'amber' : 'red';
}

export function createTraffic(route, count, blockers = []) {
  const actors = [];
  for (let index = 0; index < count; index++) {
    const direction = index % 2 ? -1 : 1;
    const actor = { id: index, direction, distance: route.length * Math.floor(index / 2) / Math.ceil(count / 2), speed: 0, cruise: 3.3 + (index * 7 % 13) / 5, length: index % 4 === 0 ? 3.5 : 3.1, width: 1.48, braking: false };
    for (let attempt = 0; attempt < 180; attempt++) {
      Object.assign(actor, sampleRoute(route, actor.distance, direction));
      if (![...blockers, ...actors].some(other => overlaps(actor, other, 3))) break;
      actor.distance = wrap(actor.distance + 1.7, route.length);
    }
    if (![...blockers, ...actors].some(other => overlaps(actor, other, 1))) actors.push(actor);
  }
  return actors;
}

export function stepTraffic(route, actors, delta, time, blockers = [], junctions = []) {
  const steps = Math.max(1, Math.ceil(delta / .02));
  const dt = Math.min(delta / steps, .02);
  for (let step = 0; step < steps; step++) {
    const proposals = actors.map(actor => {
      let gap = Infinity;
      for (const other of actors) {
        if (other === actor || other.direction !== actor.direction) continue;
        const ahead = wrap((other.distance - actor.distance) * actor.direction, route.length);
        gap = Math.min(gap, ahead - (actor.length + other.length) / 2);
      }
      for (const junction of junctions) {
        const phase = signalPhase(time, junction.offset);
        const toCenter = wrap((junction.distance - actor.distance) * actor.direction, route.length);
        const toLine = toCenter - junction.radius - actor.length / 2;
        const canStop = actor.speed * actor.speed / 9 + .8;
        if (toLine >= -.08 && (phase === 'red' || phase === 'amber' && toLine > canStop)) gap = Math.min(gap, Math.max(0, toLine));
      }
      const sight = 4 + actor.speed * 1.3 + actor.speed * actor.speed / 8;
      for (let ahead = 0; ahead < sight; ahead += .5) {
        const probe = { ...actor, ...sampleRoute(route, actor.distance + ahead * actor.direction, actor.direction) };
        if (blockers.some(other => overlaps(probe, other, .5))) { gap = Math.min(gap, Math.max(0, ahead - .6)); break; }
      }
      const desired = Math.min(actor.cruise, Math.sqrt(2 * 3.8 * Math.max(0, gap - 1.1)), Math.max(0, (gap - 1) / 1.15));
      const speed = clamp(actor.speed + clamp(desired - actor.speed, -7 * dt, 1.6 * dt), 0, actor.cruise);
      const distance = wrap(actor.distance + Math.min(speed * dt, Math.max(0, gap - .25)) * actor.direction, route.length);
      return { ...actor, ...sampleRoute(route, distance, actor.direction), distance, speed, braking: desired < actor.speed - .08 || speed < .15 };
    });
    for (let index = 0; index < actors.length; index++) {
      const proposal = proposals[index];
      if ([...blockers, ...actors.filter(other => other !== actors[index])].some(other => overlaps(proposal, other, .08))) {
        actors[index].speed = 0;
        actors[index].braking = true;
      } else Object.assign(actors[index], proposal);
    }
  }
}
