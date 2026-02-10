import type { Attachment, Message, User } from '$lib/types';

type RawDmMessage = {
	id: string;
	conversationId: string;
	senderId: string;
	content: string;
	isEdited: boolean;
	createdAt: string;
	updatedAt: string;
	sender?: User;
	attachments?: Attachment[];
};

export function mapDmMessage(message: RawDmMessage): Message {
	return {
		id: message.id,
		channelId: message.conversationId,
		authorId: message.senderId,
		content: message.content,
		replyToId: null,
		isEdited: message.isEdited,
		isPinned: false,
		reactions: [],
		author: message.sender || ({} as User),
		attachments: message.attachments || [],
		createdAt: message.createdAt,
		updatedAt: message.updatedAt
	};
}
