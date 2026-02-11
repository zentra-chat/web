import type { Attachment, LinkPreview, Message, User } from '$lib/types';

type RawDmMessage = {
	id: string;
	conversationId: string;
	senderId: string;
	content: string;
	replyTo?: {
		id: string;
		content: string;
		senderId: string;
		sender?: User;
	};
	isEdited: boolean;
	reactions?: Message['reactions'];
	linkPreviews?: LinkPreview[];
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
		reactions: message.reactions || [],
		author: message.sender || ({} as User),
		attachments: message.attachments || [],
		linkPreviews: message.linkPreviews || [],
		replyTo: message.replyTo
			? {
				id: message.replyTo.id,
				authorId: message.replyTo.senderId,
				content: message.replyTo.content,
				author: message.replyTo.sender || ({} as User),
				replyToId: null,
				isEdited: false,
				isPinned: false,
				reactions: [],
				attachments: [],
				linkPreviews: [],
				createdAt: message.createdAt,
				updatedAt: message.updatedAt
			}
			: undefined,
		createdAt: message.createdAt,
		updatedAt: message.updatedAt
	};
}
