import type { ApiError } from '$lib/types';

export interface NormalizedApiError extends ApiError {
	status?: number;
	raw?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function normalizeDetails(details: unknown): Record<string, string[] | string> | undefined {
	if (!isRecord(details)) return undefined;

	const normalized: Record<string, string[] | string> = {};
	for (const [field, value] of Object.entries(details)) {
		if (typeof value === 'string') {
			normalized[field] = value;
			continue;
		}

		if (Array.isArray(value)) {
			const values = value.filter((entry): entry is string => typeof entry === 'string');
			if (values.length > 0) {
				normalized[field] = values;
			}
		}
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeApiError(
	error: unknown,
	fallback = 'Something went wrong'
): NormalizedApiError {
	if (isRecord(error) && typeof error.error === 'string') {
		return {
			error: error.error,
			code: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR',
			details: normalizeDetails(error.details),
			status: typeof error.status === 'number' ? error.status : undefined,
			raw: error
		};
	}

	return {
		error: fallback,
		code: 'UNKNOWN_ERROR',
		raw: error
	};
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
	return normalizeApiError(error, fallback).error;
}

export function getFieldErrors(error: unknown): Record<string, string> {
	const normalized = normalizeApiError(error);
	if (!normalized.details) return {};

	const parsed: Record<string, string> = {};
	for (const [field, value] of Object.entries(normalized.details)) {
		if (typeof value === 'string') {
			parsed[field] = value;
			continue;
		}

		if (Array.isArray(value) && typeof value[0] === 'string') {
			parsed[field] = value[0];
		}
	}

	return parsed;
}
