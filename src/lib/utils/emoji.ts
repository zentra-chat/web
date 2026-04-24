import emojiData from '@emoji-mart/data/sets/15/native.json';

interface EmojiMartCategory {
	id: string;
	emojis: string[];
}

interface EmojiMartEntry {
	id: string;
	name: string;
	keywords?: string[];
	skins?: Array<{ native?: string }>;
}

interface EmojiMartData {
	categories: EmojiMartCategory[];
	emojis: Record<string, EmojiMartEntry>;
}

export interface EmojiEntry {
	id: string;
	native: string;
	name: string;
	keywords: string[];
	categoryId: string;
}

export interface EmojiCategory {
	id: string;
	label: string;
	emojis: EmojiEntry[];
}

const CATEGORY_LABELS: Record<string, string> = {
	people: 'Smileys & People',
	nature: 'Animals & Nature',
	foods: 'Food & Drink',
	activity: 'Activity',
	places: 'Travel & Places',
	objects: 'Objects',
	symbols: 'Symbols',
	flags: 'Flags'
};

const data = emojiData as EmojiMartData;

function normalizeText(value: string): string {
	return value.toLowerCase().replace(/[_:]+/g, ' ').trim();
}

const emojiById = new Map<string, EmojiEntry>();
const categories: EmojiCategory[] = [];

for (const category of data.categories) {
	const entries: EmojiEntry[] = [];

	for (const emojiId of category.emojis) {
		const item = data.emojis[emojiId];
		const native = item?.skins?.[0]?.native;
		if (!item || !native) continue;

		const entry: EmojiEntry = {
			id: item.id,
			native,
			name: item.name,
			keywords: item.keywords ?? [],
			categoryId: category.id
		};

		emojiById.set(item.id, entry);
		entries.push(entry);
	}

	categories.push({
		id: category.id,
		label: CATEGORY_LABELS[category.id] ?? category.id,
		emojis: entries
	});
}

export const EMOJI_CATEGORIES = categories;
export const ALL_EMOJIS = categories.flatMap((category) => category.emojis);

export function getEmojiById(id: string): EmojiEntry | undefined {
	return emojiById.get(id);
}

export function searchEmojis(query: string): EmojiEntry[] {
	const normalizedQuery = normalizeText(query);
	if (!normalizedQuery) return [];

	return ALL_EMOJIS.filter((emoji) => {
		if (emoji.native.includes(normalizedQuery)) return true;
		if (normalizeText(emoji.id).includes(normalizedQuery)) return true;
		if (normalizeText(emoji.name).includes(normalizedQuery)) return true;
		return emoji.keywords.some((keyword) => normalizeText(keyword).includes(normalizedQuery));
	});
}

/**
 * Resolve a :shortcode: to a native emoji character.
 * Looks up by emoji ID (which is the shortcode used by emoji-mart).
 */
export function resolveShortcode(shortcode: string): string | undefined {
	const entry = emojiById.get(shortcode);
	return entry?.native;
}
