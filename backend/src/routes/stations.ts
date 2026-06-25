import type { FastifyInstance } from 'fastify';
import { reportToHistoryItem } from '../services/aggregation.js';
import {
  findNearbyStations,
  getStationById,
  listStationsInBbox,
  searchStationsByName,
} from '../services/stations.js';

export async function stationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string } }>('/api/stations/search', async (request, reply) => {
    const q = request.query.q?.trim();
    if (!q || q.length < 2) {
      return reply.status(400).send({ error: 'q parameter required (min 2 chars)' });
    }
    const stations = await searchStationsByName(q);
    return { stations };
  });

  app.get<{
    Querystring: {
      bbox?: string;
      fuel_types?: string;
      hide_unavailable?: string;
      hide_without_fuel?: string;
    };
  }>('/api/stations', async (request, reply) => {
    const { bbox, fuel_types, hide_unavailable, hide_without_fuel } = request.query;

    if (!bbox) {
      return reply.status(400).send({
        error: 'bbox query parameter is required (minLng,minLat,maxLng,maxLat)',
      });
    }

    try {
      const stations = await listStationsInBbox({
        bbox,
        fuelTypes: fuel_types,
        hideUnavailable: hide_unavailable === 'true' || hide_unavailable === '1',
        hideWithoutFuel: hide_without_fuel === 'true' || hide_without_fuel === '1',
      });
      return { stations };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      if (message === 'INVALID_BBOX') {
        return reply.status(400).send({ error: 'Invalid bbox format or values' });
      }
      if (message === 'INVALID_FUEL_TYPES') {
        return reply.status(400).send({ error: 'Invalid fuel_types codes' });
      }
      throw err;
    }
  });

  app.get<{
    Querystring: {
      lat?: string;
      lng?: string;
      radius?: string;
      fuel_types?: string;
      hide_unavailable?: string;
    };
  }>('/api/stations/nearby', async (request, reply) => {
    const { lat, lng, radius, fuel_types, hide_unavailable } = request.query;

    if (!lat || !lng || !radius) {
      return reply.status(400).send({
        error: 'lat, lng, and radius query parameters are required',
      });
    }

    try {
      const stations = await findNearbyStations({
        lat: Number(lat),
        lng: Number(lng),
        radius: Number(radius),
        fuelTypes: fuel_types,
        hideUnavailable: hide_unavailable === 'true' || hide_unavailable === '1',
      });
      return { stations };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      if (message === 'INVALID_COORDS') {
        return reply.status(400).send({ error: 'Invalid lat or lng' });
      }
      if (message === 'INVALID_RADIUS') {
        return reply.status(400).send({ error: 'Invalid radius (1-100000 meters)' });
      }
      if (message === 'INVALID_FUEL_TYPES') {
        return reply.status(400).send({ error: 'Invalid fuel_types codes' });
      }
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>('/api/stations/:id', async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: 'Invalid station id' });
    }

    const result = await getStationById(id);
    if (!result) {
      return reply.status(404).send({ error: 'Station not found' });
    }

    return {
      station: result.station,
      fuel_status: result.fuel_status,
      reports: result.reports.map(reportToHistoryItem),
    };
  });
}
