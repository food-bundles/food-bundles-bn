"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationService = void 0;
class PaginationService {
    static async paginate(model, query, options = {}) {
        const { page, limit } = query;
        const skip = (page - 1) * limit;
        const queryOptions = {
            skip,
            take: limit,
            ...options,
        };
        const [data, total] = await Promise.all([
            model.findMany(queryOptions),
            model.count({ where: options.where }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return {
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    }
    static validatePaginationParams(page, limit) {
        const normalizedPage = Math.max(1, parseInt(String(page || 1)));
        const normalizedLimit = Math.min(100, Math.max(1, parseInt(String(limit || 10))));
        return {
            page: normalizedPage,
            limit: normalizedLimit,
        };
    }
    static createPaginationMeta(total, query) {
        const { page, limit } = query;
        const totalPages = Math.ceil(total / limit);
        return {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        };
    }
}
exports.PaginationService = PaginationService;
