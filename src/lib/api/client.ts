import { get } from 'svelte/store';
import { activeInstance, activeAuth, setInstanceAuth, clearInstanceAuth } from '$lib/stores/instance';
import type {
	ApiResponse,
	PaginatedResponse,
	ApiError,
	AuthResponse,
	LoginRequest,
	RegisterRequest,
	FullUser,
	User,
	UserSettings,
	Community,
	Channel,
	ChannelCategory,
	CommunityMember,
	Message,
	SendMessageRequest,
	Attachment
} from '$lib/types';

class ApiClient {
	private getBaseUrl(): string {
		const instance = get(activeInstance);
		if (!instance) throw new Error('No active instance');
		return `${instance.url}/api/v1`;
	}

	private getHeaders(includeAuth = true): HeadersInit {
		const headers: HeadersInit = {
			'Content-Type': 'application/json'
		};

		if (includeAuth) {
			const auth = get(activeAuth);
			if (auth) {
				headers['Authorization'] = `Bearer ${auth.accessToken}`;
			}
		}

		return headers;
	}

	private async handleResponse<T>(response: Response): Promise<T> {
		if (!response.ok) {
			let error: ApiError;
			try {
				error = await response.json();
			} catch {
				error = {
					error: 'Network error',
					code: 'NETWORK_ERROR'
				};
			}

			// Handle token expiration
			if (response.status === 401) {
				const refreshed = await this.refreshToken();
				if (!refreshed) {
					throw error;
				}
				// Caller should retry the request
				throw { ...error, shouldRetry: true };
			}

			throw error;
		}

		// Handle 204 No Content
		if (response.status === 204) {
			return undefined as T;
		}

		return response.json();
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
		includeAuth = true,
		retry = true
	): Promise<T> {
		const url = `${this.getBaseUrl()}${endpoint}`;
		const headers = this.getHeaders(includeAuth);

		try {
			const response = await fetch(url, {
				...options,
				headers: { ...headers, ...options.headers }
			});

			return await this.handleResponse<T>(response);
		} catch (error) {
			if (retry && (error as any).shouldRetry) {
				// Retry the request after token refresh
				const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
					...options,
					headers: { ...this.getHeaders(includeAuth), ...options.headers }
				});
				return await this.handleResponse<T>(response);
			}
			throw error;
		}
	}

	private async refreshToken(): Promise<boolean> {
		const auth = get(activeAuth);
		const instance = get(activeInstance);
		if (!auth || !instance) return false;

		try {
			const response = await fetch(`${instance.url}/api/v1/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refreshToken: auth.refreshToken })
			});

			if (!response.ok) return false;

			const result: ApiResponse<AuthResponse> = await response.json();
			setInstanceAuth(instance.id, {
				instanceId: instance.id,
				accessToken: result.data.accessToken,
				refreshToken: result.data.refreshToken,
				expiresAt: result.data.expiresAt,
				user: result.data.user
			});

			return true;
		} catch {
			clearInstanceAuth(instance.id);
			return false;
		}
	}

	// Auth endpoints
	async register(data: RegisterRequest): Promise<AuthResponse> {
		const result = await this.request<ApiResponse<AuthResponse>>(
			'/auth/register',
			{
				method: 'POST',
				body: JSON.stringify(data)
			},
			false
		);
		return result.data;
	}

	async login(data: LoginRequest): Promise<AuthResponse> {
		const result = await this.request<ApiResponse<AuthResponse>>(
			'/auth/login',
			{
				method: 'POST',
				body: JSON.stringify(data)
			},
			false
		);
		return result.data;
	}

	async logout(): Promise<void> {
		try {
			await this.request('/auth/logout', { method: 'POST' });
		} finally {
			const instance = get(activeInstance);
			if (instance) {
				clearInstanceAuth(instance.id);
			}
		}
	}

	// User endpoints
	async getCurrentUser(): Promise<FullUser> {
		const result = await this.request<ApiResponse<FullUser>>('/users/me');
		return result.data;
	}

	async updateProfile(data: Partial<{ displayName: string; bio: string; customStatus: string }>): Promise<FullUser> {
		const payload: Partial<{ displayName: string; bio: string; customStatus: string }> = {};
		if (data.displayName !== undefined) payload.displayName = data.displayName;
		if (data.bio !== undefined) payload.bio = data.bio;
		if (data.customStatus !== undefined) payload.customStatus = data.customStatus;

		const result = await this.request<ApiResponse<FullUser>>('/users/me', {
			method: 'PATCH',
			body: JSON.stringify(payload)
		});
		return result.data;
	}

	async deleteAccount(): Promise<void> {
		await this.request('/users/me', { method: 'DELETE' });
	}

	async updateAvatar(file: File): Promise<string> {
		const formData = new FormData();
		formData.append('avatar', file);

		const auth = get(activeAuth);
		const response = await fetch(`${this.getBaseUrl()}/media/avatars/user`, {
			method: 'POST',
			headers: {
				Authorization: auth ? `Bearer ${auth.accessToken}` : ''
			},
			body: formData
		});

		const result: ApiResponse<{ url: string }> = await response.json();
		if (!response.ok) throw result;
		return result.data.url;
	}

	async removeAvatar(): Promise<void> {
		await this.request('/users/me/avatar', { method: 'DELETE' });
	}

	async updateStatus(status: string): Promise<void> {
		await this.request('/users/me/status', {
			method: 'PUT',
			body: JSON.stringify({ status })
		});
	}

	async getUserSettings(): Promise<UserSettings> {
		const result = await this.request<ApiResponse<UserSettings>>('/users/me/settings');
		return result.data;
	}

	async updateUserSettings(data: Partial<UserSettings>): Promise<UserSettings> {
		const result = await this.request<ApiResponse<UserSettings>>('/users/me/settings', {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
		return result.data;
	}

	async searchUsers(query: string, page = 1, pageSize = 20): Promise<PaginatedResponse<User>> {
		return this.request<PaginatedResponse<User>>(
			`/users/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`
		);
	}

	async getUser(userId: string): Promise<User> {
		const result = await this.request<ApiResponse<User>>(`/users/${userId}`);
		return result.data;
	}

	// Community endpoints
	async discoverCommunities(query?: string, page = 1, pageSize = 20): Promise<Community[]> {
		const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
		if (query) params.set('q', query);
		const result = await this.request<ApiResponse<Community[]>>(`/communities/discover?${params}`);
		return result.data;
	}

	async getMyCommunities(): Promise<Community[]> {
		const result = await this.request<ApiResponse<Community[]>>('/communities');
		return result.data;
	}

	async getCommunities(): Promise<Community[]> {
		return this.getMyCommunities();
	}

	async getCommunity(communityId: string): Promise<Community> {
		const result = await this.request<ApiResponse<Community>>(`/communities/${communityId}`);
		return result.data;
	}

	async createCommunity(data: { name: string; description?: string; isPrivate?: boolean }): Promise<Community> {
		const result = await this.request<ApiResponse<Community>>('/communities', {
			method: 'POST',
			body: JSON.stringify({
				name: data.name,
				description: data.description,
				isPublic: !data.isPrivate,
				isOpen: true // Default to true
			})
		});
		return result.data;
	}

	async updateCommunity(communityId: string, data: Partial<Community>): Promise<Community> {
		const result = await this.request<ApiResponse<Community>>(`/communities/${communityId}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		});
		return result.data;
	}

	async deleteCommunity(communityId: string): Promise<void> {
		await this.request(`/communities/${communityId}`, { method: 'DELETE' });
	}

	async joinCommunity(communityId: string): Promise<void> {
		await this.request(`/communities/${communityId}/join`, { method: 'POST' });
	}

	async leaveCommunity(communityId: string): Promise<void> {
		await this.request(`/communities/${communityId}/leave`, { method: 'POST' });
	}

	async updateCommunityIcon(communityId: string, file: File): Promise<string> {
		const formData = new FormData();
		formData.append('icon', file);

		const auth = get(activeAuth);
		const response = await fetch(`${this.getBaseUrl()}/media/communities/${communityId}/icon`, {
			method: 'POST',
			headers: {
				Authorization: auth ? `Bearer ${auth.accessToken}` : ''
			},
			body: formData
		});

		const result: ApiResponse<{ url: string }> = await response.json();
		if (!response.ok) throw result;
		return result.data.url;
	}

	async removeCommunityIcon(communityId: string): Promise<void> {
		await this.request(`/communities/${communityId}/icon`, { method: 'DELETE' });
	}

	async createInvite(communityId: string, options?: { maxUses?: number; expiresAt?: string }): Promise<{ code: string }> {
		const result = await this.request<ApiResponse<{ code: string }>>(`/communities/${communityId}/invites`, {
			method: 'POST',
			body: JSON.stringify(options || {})
		});
		return result.data;
	}

	async joinWithInvite(code: string): Promise<Community> {
		const result = await this.request<ApiResponse<Community>>(`/communities/join/${code}`, {
			method: 'POST'
		});
		return result.data;
	}

	async getInviteInfo(code: string): Promise<{ community: Community; valid: boolean }> {
		const result = await this.request<ApiResponse<{ community: Community; valid: boolean }>>(
			`/communities/invite/${code}`,
			{},
			false
		);
		return result.data;
	}

	async getCommunityMembers(communityId: string, page = 1, pageSize = 50): Promise<CommunityMember[]> {
		const result = await this.request<ApiResponse<CommunityMember[]>>(
			`/communities/${communityId}/members?page=${page}&pageSize=${pageSize}`
		);
		return result.data;
	}

	// Channel endpoints
	async getChannels(communityId: string): Promise<Channel[]> {
		const result = await this.request<ApiResponse<Channel[]>>(`/channels/communities/${communityId}/channels`);
		return result.data;
	}

	async getChannel(channelId: string): Promise<Channel> {
		const result = await this.request<ApiResponse<Channel>>(`/channels/${channelId}`);
		return result.data;
	}

	async createChannel(communityId: string, data: { name: string; type?: string; topic?: string; categoryId?: string; isNsfw?: boolean }): Promise<Channel> {
		const result = await this.request<ApiResponse<Channel>>(`/channels/communities/${communityId}/channels`, {
			method: 'POST',
			body: JSON.stringify({
				name: data.name,
				type: data.type || 'text',
				topic: data.topic,
				categoryId: data.categoryId,
				isNsfw: !!data.isNsfw,
				slowmodeSeconds: 0
			})
		});
		return result.data;
	}

	async updateChannel(channelId: string, data: Partial<{ name: string; topic: string; categoryId: string | null; isNsfw: boolean; slowmodeSeconds: number }>): Promise<Channel> {
		const payload: any = {};
		if (data.name !== undefined) payload.name = data.name;
		if (data.topic !== undefined) payload.topic = data.topic;
		if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
		if (data.isNsfw !== undefined) payload.isNsfw = data.isNsfw;
		if (data.slowmodeSeconds !== undefined) payload.slowmodeSeconds = data.slowmodeSeconds;

		const result = await this.request<ApiResponse<Channel>>(`/channels/${channelId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload)
		});
		return result.data;
	}

	async deleteChannel(channelId: string): Promise<void> {
		await this.request(`/channels/${channelId}`, { method: 'DELETE' });
	}

	// Category endpoints
	async getCategories(communityId: string): Promise<ChannelCategory[]> {
		const result = await this.request<ApiResponse<ChannelCategory[]>>(`/channels/communities/${communityId}/categories`);
		return result.data;
	}

	async createCategory(communityId: string, name: string): Promise<ChannelCategory> {
		const result = await this.request<ApiResponse<ChannelCategory>>(`/channels/communities/${communityId}/categories`, {
			method: 'POST',
			body: JSON.stringify({ name })
		});
		return result.data;
	}

	// Message endpoints
	async getMessages(channelId: string, options?: { limit?: number; before?: string; after?: string }): Promise<Message[]> {
		const params = new URLSearchParams();
		if (options?.limit) params.set('limit', String(options.limit));
		if (options?.before) params.set('before', options.before);
		if (options?.after) params.set('after', options.after);

		const result = await this.request<ApiResponse<Message[]>>(
			`/messages/channels/${channelId}/messages?${params}`
		);
		return result.data;
	}

	async sendMessage(channelId: string, data: SendMessageRequest): Promise<Message> {
		const result = await this.request<ApiResponse<Message>>(
			`/messages/channels/${channelId}/messages`,
			{
				method: 'POST',
				body: JSON.stringify(data)
			}
		);
		return result.data;
	}

	async editMessage(messageId: string, content: string): Promise<Message> {
		const result = await this.request<ApiResponse<Message>>(`/messages/${messageId}`, {
			method: 'PATCH',
			body: JSON.stringify({ content })
		});
		return result.data;
	}

	async deleteMessage(messageId: string): Promise<void> {
		await this.request(`/messages/${messageId}`, { method: 'DELETE' });
	}

	async addReaction(messageId: string, emoji: string): Promise<void> {
		await this.request(`/messages/${messageId}/reactions`, {
			method: 'POST',
			body: JSON.stringify({ emoji })
		});
	}

	async removeReaction(messageId: string, emoji: string): Promise<void> {
		await this.request(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
			method: 'DELETE'
		});
	}

	async sendTypingIndicator(channelId: string): Promise<void> {
		await this.request(`/messages/channels/${channelId}/messages/typing`, {
			method: 'POST'
		});
	}

	// Media endpoints
	async uploadAttachment(file: File): Promise<Attachment> {
		const formData = new FormData();
		formData.append('file', file);

		const auth = get(activeAuth);
		const response = await fetch(`${this.getBaseUrl()}/media/attachments`, {
			method: 'POST',
			headers: {
				Authorization: auth ? `Bearer ${auth.accessToken}` : ''
			},
			body: formData
		});

		const result: ApiResponse<Attachment> = await response.json();
		if (!response.ok) throw result;
		return result.data;
	}

	// Health check
	async checkHealth(baseUrl: string): Promise<boolean> {
		try {
			const response = await fetch(`${baseUrl}/health`, {
				method: 'GET',
				signal: AbortSignal.timeout(5000)
			});
			return response.ok;
		} catch {
			return false;
		}
	}
}

export const api = new ApiClient();