import { writable, derived, get } from 'svelte/store';
import { websocket } from '$lib/api/websocket';
import { api } from '$lib/api';
import { currentUserId } from '$lib/stores/instance';
import { addToast } from '$lib/stores/ui';
import type { VoiceState, VoiceJoinEvent, VoiceLeaveEvent, VoiceStateUpdateEvent, VoiceSignalEvent } from '$lib/types';

// ICE servers for WebRTC (using public STUN servers)
const ICE_SERVERS: RTCIceServer[] = [
	{ urls: 'stun:stun.l.google.com:19302' },
	{ urls: 'stun:stun1.l.google.com:19302' }
];

// Voice connection state
export type VoiceConnectionState = 'disconnected' | 'connecting' | 'connected';

// Current voice channel ID
export const voiceChannelId = writable<string | null>(null);

// Current voice connection state
export const voiceConnectionState = writable<VoiceConnectionState>('disconnected');

// Participants in the current voice channel (channelId -> VoiceState[])
export const voiceParticipants = writable<Record<string, VoiceState[]>>({});

// Self mute/deafen state
export const isSelfMuted = writable(false);
export const isSelfDeafened = writable(false);
export const isSelfScreenSharing = writable(false);

// Remote screen-share streams (userId -> MediaStream)
export const screenShareStreams = writable<Record<string, MediaStream>>({});

// Users currently speaking (userId -> boolean)
export const speakingUsers = writable<Record<string, boolean>>({});

// Audio streams from peers (userId -> MediaStream)
const peerStreams = new Map<string, MediaStream>();

// Screen stream IDs by user so we can distinguish screen-share audio from mic audio
const screenShareStreamIds = new Map<string, string>();

// Peer connections (userId -> RTCPeerConnection)
const peerConnections = new Map<string, RTCPeerConnection>();

// Per-peer offer state to avoid concurrent renegotiation glare
const makingOffers = new Map<string, boolean>();

// Buffered ICE candidates for peers that don't have a connection yet
const pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>();

// Audio analysers for speaking detection (userId -> { analyser, interval })
const audioAnalysers = new Map<string, { analyser: AnalyserNode; interval: ReturnType<typeof setInterval> }>();

// Local media stream
let localStream: MediaStream | null = null;
let localScreenStream: MediaStream | null = null;

// Monotonic join attempt counter used to cancel stale join operations
let joinAttemptCounter = 0;

// Local audio context for speaking detection
let localAudioContext: AudioContext | null = null;

// WebSocket event unsubscribers
let unsubscribers: (() => void)[] = [];
let listenersInitialized = false;

// Derived store: am I in a voice channel?
export const isInVoiceCall = derived(voiceChannelId, ($id) => $id !== null);

// Derived: participants for the current voice channel
export const currentVoiceParticipants = derived(
	[voiceChannelId, voiceParticipants],
	([$channelId, $participants]) => {
		if (!$channelId) return [];
		return $participants[$channelId] || [];
	}
);

// Get audio element or create one for a peer
function getOrCreateAudioElement(userId: string): HTMLAudioElement {
	let el = document.getElementById(`voice-audio-${userId}`) as HTMLAudioElement;
	if (!el) {
		el = document.createElement('audio');
		el.id = `voice-audio-${userId}`;
		el.autoplay = true;
		el.style.display = 'none';
		document.body.appendChild(el);
	}
	return el;
}

function removeAudioElement(userId: string) {
	const el = document.getElementById(`voice-audio-${userId}`);
	if (el) {
		el.remove();
	}
}

function setScreenShareStream(userId: string, stream: MediaStream | null) {
	screenShareStreams.update((streams) => {
		const next = { ...streams };
		if (stream) {
			next[userId] = stream;
		} else {
			delete next[userId];
		}
		return next;
	});
}

function setParticipantScreenSharing(channelId: string, userId: string, isScreenSharing: boolean) {
	voiceParticipants.update((participants) => {
		const existing = participants[channelId] || [];
		return {
			...participants,
			[channelId]: existing.map((state) =>
				state.userId === userId ? { ...state, isScreenSharing } : state
			)
		};
	});
}

function renegotiatePeer(userId: string, channelId: string) {
	void sendOffer(userId, channelId, false);
}

async function sendOffer(userId: string, channelId: string, iceRestart: boolean) {
	const pc = peerConnections.get(userId);
	if (!pc) return;
	if (makingOffers.get(userId)) return;
	if (pc.signalingState !== 'stable') return;

	makingOffers.set(userId, true);

	try {
		const offer = await pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
		await pc.setLocalDescription(offer);

		websocket.send({
			type: 'VOICE_SIGNAL',
			data: {
				channelId,
				targetUserId: userId,
				signalType: 'offer',
				signal: pc.localDescription?.toJSON()
			}
		});
	} catch (err) {
		console.error('Failed to send offer:', err);
	} finally {
		makingOffers.set(userId, false);
	}
}

function renegotiateAllPeers(channelId: string) {
	peerConnections.forEach((_, userId) => {
		renegotiatePeer(userId, channelId);
	});
}

// Create a peer connection for a user
function createPeerConnection(userId: string, channelId: string, initiator: boolean) {
	if (peerConnections.has(userId)) {
		peerConnections.get(userId)?.close();
	}

	const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
	peerConnections.set(userId, pc);
	makingOffers.set(userId, false);

	// Add local tracks
	if (localStream) {
		localStream.getTracks().forEach((track) => {
			pc.addTrack(track, localStream!);
		});
	}
	if (localScreenStream) {
		localScreenStream.getTracks().forEach((track) => {
			pc.addTrack(track, localScreenStream!);
		});
	}

	// Handle ICE candidates
	pc.onicecandidate = (event) => {
		if (event.candidate) {
			websocket.send({
				type: 'VOICE_SIGNAL',
				data: {
					channelId,
					targetUserId: userId,
					signalType: 'ice-candidate',
					signal: event.candidate.toJSON()
				}
			});
		}
	};

	// Handle remote tracks
	pc.ontrack = (event) => {
		const track = event.track;
		if (track.kind === 'video') {
			const screenStream = event.streams[0] || new MediaStream([track]);
			screenShareStreamIds.set(userId, screenStream.id);
			setScreenShareStream(userId, screenStream);
			track.onended = () => {
				screenShareStreamIds.delete(userId);
				setScreenShareStream(userId, null);
			};
			return;
		}

		const stream = event.streams[0];
		if (!stream) return;

		if (screenShareStreamIds.get(userId) === stream.id) {
			// Screen-share audio is rendered by the screen-share video element.
			return;
		}

		peerStreams.set(userId, stream);
		const audio = getOrCreateAudioElement(userId);
		audio.srcObject = stream;

		// Respect deafen state
		audio.muted = get(isSelfDeafened);

		// Set up speaking detection for this peer
		startSpeakingDetection(userId, stream);
	};

	pc.oniceconnectionstatechange = () => {
		if (pc.iceConnectionState === 'failed') {
			// Try to recover with an ICE restart if we're the initiator
			if (initiator) {
				console.warn(`ICE failed for peer ${userId}, attempting restart`);
				void sendOffer(userId, channelId, true);
			}
		} else if (pc.iceConnectionState === 'disconnected') {
			console.warn(`ICE disconnected for peer ${userId}`);
		}
	};

	// If we're the initiator, create and send offer
	if (initiator) {
		void sendOffer(userId, channelId, false);
	}

	return pc;
}

// Handle incoming voice signal
function handleVoiceSignal(data: VoiceSignalEvent) {
	const myId = get(currentUserId);
	if (!myId || data.targetUserId !== myId) return;

	const channelId = get(voiceChannelId);
	if (!channelId || channelId !== data.channelId) return;

	switch (data.signalType) {
		case 'offer': {
			void (async () => {
				let pc = peerConnections.get(data.fromUserId);
				if (!pc) {
					pc = createPeerConnection(data.fromUserId, channelId, false);
				}

				try {
					const offer = new RTCSessionDescription(data.signal as RTCSessionDescriptionInit);
					const offerCollision = makingOffers.get(data.fromUserId) || pc.signalingState !== 'stable';

					if (offerCollision && pc.signalingState === 'have-local-offer') {
						await pc.setLocalDescription({ type: 'rollback' });
					}

					await pc.setRemoteDescription(offer);

					const queued = pendingIceCandidates.get(data.fromUserId) || [];
					pendingIceCandidates.delete(data.fromUserId);
					for (const candidate of queued) {
						try {
							await pc.addIceCandidate(new RTCIceCandidate(candidate));
						} catch {
							// Ignore stale buffered candidates during renegotiation.
						}
					}

					const answer = await pc.createAnswer();
					await pc.setLocalDescription(answer);

					websocket.send({
						type: 'VOICE_SIGNAL',
						data: {
							channelId,
							targetUserId: data.fromUserId,
							signalType: 'answer',
							signal: pc.localDescription?.toJSON()
						}
					});
				} catch (err) {
					console.error('Failed to handle offer:', err);
				}
			})();
			break;
		}
		case 'answer': {
			const pc = peerConnections.get(data.fromUserId);
			if (pc && pc.signalingState === 'have-local-offer') {
				const answer = new RTCSessionDescription(data.signal as RTCSessionDescriptionInit);
				pc.setRemoteDescription(answer)
					.then(() => {
						// Flush buffered ICE candidates now that remote description is set
						const queued = pendingIceCandidates.get(data.fromUserId) || [];
						pendingIceCandidates.delete(data.fromUserId);
						return Promise.all(
							queued.map((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}))
						);
					})
					.catch((err) => {
						console.warn('Failed to set remote description, will renegotiate:', err);
						void sendOffer(data.fromUserId, channelId, true);
					});
			}
			break;
		}
		case 'ice-candidate': {
			const pc = peerConnections.get(data.fromUserId);
			// Only add ICE candidates if the PC exists and has a remote description set
			if (pc && pc.remoteDescription) {
				const candidate = new RTCIceCandidate(data.signal as RTCIceCandidateInit);
				pc.addIceCandidate(candidate).catch(() => {});
			} else {
				// Buffer the candidate until the PC is ready
				const queue = pendingIceCandidates.get(data.fromUserId) || [];
				queue.push(data.signal as RTCIceCandidateInit);
				pendingIceCandidates.set(data.fromUserId, queue);
			}
			break;
		}
	}
}

// Handle voice join event
function handleVoiceJoin(data: VoiceJoinEvent) {
	const myId = get(currentUserId);
	const currentChannelId = get(voiceChannelId);

	if (data.participants) {
		// This is our own self-join response from the server. It includes the
		// full participant list so we can populate it all at once.
		voiceParticipants.update((p) => ({
			...p,
			[data.channelId]: data.participants!
		}));
		// Don't create peer connections here - existing users will send us offers
		return;
	}

	// Someone else joined a channel - update the participant list
	voiceParticipants.update((p) => {
		const existing = p[data.channelId] || [];
		const filtered = existing.filter((s) => s.userId !== data.userId);
		const newState: VoiceState = {
			...data.state,
			user: data.user
		};
		return { ...p, [data.channelId]: [...filtered, newState] };
	});

	// If we're in the same voice channel, initiate a connection to the new user
	if (currentChannelId === data.channelId && data.userId !== myId && myId) {
		createPeerConnection(data.userId, data.channelId, true);
	}
}

// Handle voice leave event
function handleVoiceLeave(data: VoiceLeaveEvent) {
	// Remove from participants
	voiceParticipants.update((p) => {
		const existing = p[data.channelId] || [];
		return { ...p, [data.channelId]: existing.filter((s) => s.userId !== data.userId) };
	});

	// Clean up peer connection
	const pc = peerConnections.get(data.userId);
	if (pc) {
		pc.close();
		peerConnections.delete(data.userId);
	}
	peerStreams.delete(data.userId);
	screenShareStreamIds.delete(data.userId);
	setScreenShareStream(data.userId, null);
	pendingIceCandidates.delete(data.userId);
	removeAudioElement(data.userId);
	stopSpeakingDetection(data.userId);
}

// Handle voice state update (mute/deafen)
function handleVoiceStateUpdate(data: VoiceStateUpdateEvent) {
	if (!data.state.isScreenSharing) {
		setScreenShareStream(data.userId, null);
	}

	voiceParticipants.update((p) => {
		const existing = p[data.channelId] || [];
		return {
			...p,
			[data.channelId]: existing.map((s) =>
				s.userId === data.userId ? { ...s, ...data.state } : s
			)
		};
	});
}

// Initialize WebSocket listeners for voice events
function setupVoiceListeners() {
	if (listenersInitialized) {
		return;
	}

	listenersInitialized = true;

	unsubscribers.push(
		websocket.on('VOICE_JOIN', (data) => handleVoiceJoin(data as VoiceJoinEvent)),
		websocket.on('VOICE_LEAVE', (data) => handleVoiceLeave(data as VoiceLeaveEvent)),
		websocket.on('VOICE_STATE_UPDATE', (data) =>
			handleVoiceStateUpdate(data as VoiceStateUpdateEvent)
		),
		websocket.on('VOICE_SIGNAL', (data) => handleVoiceSignal(data as VoiceSignalEvent))
	);
}

function cleanupVoiceListeners() {
	unsubscribers.forEach((unsub) => unsub());
	unsubscribers = [];
	listenersInitialized = false;
}

function removeUserFromChannelParticipants(channelId: string, userId: string) {
	voiceParticipants.update((participants) => {
		const existing = participants[channelId] || [];
		return {
			...participants,
			[channelId]: existing.filter((state) => state.userId !== userId)
		};
	});
}

function removeUserFromAllOtherChannels(targetChannelId: string, userId: string) {
	voiceParticipants.update((participants) => {
		const next = { ...participants };
		for (const [channelId, states] of Object.entries(next)) {
			if (channelId === targetChannelId) {
				continue;
			}
			next[channelId] = states.filter((state) => state.userId !== userId);
		}
		return next;
	});
}

// Join a voice channel
export async function joinVoiceChannel(channelId: string) {
	const currentChannel = get(voiceChannelId);
	if (currentChannel === channelId && get(voiceConnectionState) === 'connected') return;

	// Leave current channel first
	if (currentChannel) {
		await leaveVoiceChannel();
	}

	const attemptId = ++joinAttemptCounter;

	voiceConnectionState.set('connecting');

	try {
		// Get microphone access
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true
			},
			video: false
		});

		if (attemptId != joinAttemptCounter) {
			stream.getTracks().forEach((track) => track.stop());
			return;
		}

		localStream = stream;

		// Set up listeners before sending join so we catch the server's response
		setupVoiceListeners();

		// Join via WebSocket - the server will reply with a VOICE_JOIN event
		// containing the full participant list (handled by handleVoiceJoin).
		// Existing participants will send us WebRTC offers.
		websocket.send({
			type: 'VOICE_JOIN',
			data: { channelId }
		});

		voiceChannelId.set(channelId);
		isSelfMuted.set(false);
		isSelfDeafened.set(false);
		isSelfScreenSharing.set(false);
		voiceConnectionState.set('connected');

		const myId = get(currentUserId);
		if (myId) {
			removeUserFromAllOtherChannels(channelId, myId);
		}

		// Start detecting when we're speaking
		startLocalSpeakingDetection();
	} catch (err: unknown) {
		if (attemptId != joinAttemptCounter) {
			return;
		}
		console.error('Failed to join voice channel:', err);
		voiceConnectionState.set('disconnected');
		voiceChannelId.set(null);

		if (err instanceof Error && err.name === 'NotAllowedError') {
			addToast({ type: 'error', message: 'Microphone access denied. Please allow microphone access to join voice channels.' });
		} else {
			addToast({ type: 'error', message: 'Failed to join voice channel' });
		}
	}
}

// Leave the current voice channel
export async function leaveVoiceChannel() {
	joinAttemptCounter++;

	const channelId = get(voiceChannelId);
	if (!channelId) return;

	const myId = get(currentUserId);
	if (myId) {
		removeUserFromChannelParticipants(channelId, myId);
	}

	// Send leave via WebSocket
	websocket.send({
		type: 'VOICE_LEAVE',
		data: { channelId }
	});

	cleanupVoiceResources();
}

// Clean up all voice resources without sending a leave message
// (used for page unload where we can't wait for a response)
function cleanupVoiceResources() {
	// Stop all speaking detection
	audioAnalysers.forEach((_, userId) => stopSpeakingDetection(userId));
	speakingUsers.set({});

	// Close all peer connections
	peerConnections.forEach((pc) => pc.close());
	peerConnections.clear();
	peerStreams.clear();
	screenShareStreamIds.clear();
	screenShareStreams.set({});
	pendingIceCandidates.clear();

	// Stop local stream
	if (localStream) {
		localStream.getTracks().forEach((track) => track.stop());
		localStream = null;
	}
	if (localScreenStream) {
		localScreenStream.getTracks().forEach((track) => track.stop());
		localScreenStream = null;
	}

	// Close audio context
	if (localAudioContext) {
		localAudioContext.close().catch(() => {});
		localAudioContext = null;
	}

	// Remove all audio elements
	document.querySelectorAll('[id^="voice-audio-"]').forEach((el) => el.remove());

	// Clean up listeners
	// Keep listeners active so channel sidebar voice state stays live even when not in a call.

	// Update stores
	voiceChannelId.set(null);
	voiceConnectionState.set('disconnected');
	isSelfMuted.set(false);
	isSelfDeafened.set(false);
	isSelfScreenSharing.set(false);
}

// Toggle self mute
export function toggleMute() {
	const channelId = get(voiceChannelId);
	if (!channelId) return;

	const newMuted = !get(isSelfMuted);
	isSelfMuted.set(newMuted);

	// Mute/unmute local audio tracks
	if (localStream) {
		localStream.getAudioTracks().forEach((track) => {
			track.enabled = !newMuted;
		});
	}

	// Notify server
	websocket.send({
		type: 'VOICE_STATE_UPDATE',
		data: {
			channelId,
			isSelfMuted: newMuted
		}
	});
}

// Toggle self deafen
export function toggleDeafen() {
	const channelId = get(voiceChannelId);
	if (!channelId) return;

	const newDeafened = !get(isSelfDeafened);
	isSelfDeafened.set(newDeafened);

	// Mute/unmute all remote audio
	document.querySelectorAll<HTMLAudioElement>('[id^="voice-audio-"]').forEach((el) => {
		el.muted = newDeafened;
	});

	// If deafening, also mute self
	if (newDeafened && !get(isSelfMuted)) {
		isSelfMuted.set(true);
		if (localStream) {
			localStream.getAudioTracks().forEach((track) => {
				track.enabled = false;
			});
		}
	}

	// Notify server
	websocket.send({
		type: 'VOICE_STATE_UPDATE',
		data: {
			channelId,
			isSelfMuted: get(isSelfMuted),
			isSelfDeafened: newDeafened
		}
	});
}

async function stopScreenShareInternal(notifyServer: boolean) {
	const channelId = get(voiceChannelId);
	if (!localScreenStream) {
		if (notifyServer && channelId) {
			websocket.send({
				type: 'VOICE_STATE_UPDATE',
				data: {
					channelId,
					isScreenSharing: false
				}
			});
		}
		isSelfScreenSharing.set(false);
		return;
	}

	const myId = get(currentUserId);

	const streamToStop = localScreenStream;
	peerConnections.forEach((pc) => {
		pc.getSenders().forEach((sender) => {
			if (sender.track && streamToStop.getTracks().some((track) => track.id === sender.track?.id)) {
				pc.removeTrack(sender);
			}
		});
	});

	streamToStop.getTracks().forEach((track) => track.stop());
	localScreenStream = null;
	isSelfScreenSharing.set(false);
	if (myId) {
		setScreenShareStream(myId, null);
	}

	if (channelId && myId) {
		setParticipantScreenSharing(channelId, myId, false);
		renegotiateAllPeers(channelId);
	}

	if (notifyServer && channelId) {
		websocket.send({
			type: 'VOICE_STATE_UPDATE',
			data: {
				channelId,
				isScreenSharing: false
			}
		});
	}
}

export async function startScreenShare() {
	const channelId = get(voiceChannelId);
	if (!channelId || get(voiceConnectionState) !== 'connected') {
		addToast({ type: 'error', message: 'Join a voice channel before sharing your screen.' });
		return;
	}

	if (localScreenStream) {
		return;
	}

	try {
		const stream = await navigator.mediaDevices.getDisplayMedia({
			video: {
				frameRate: 30
			},
			audio: true
		});

		localScreenStream = stream;
		isSelfScreenSharing.set(true);

		const myId = get(currentUserId);
		if (myId) {
			setScreenShareStream(myId, stream);
			setParticipantScreenSharing(channelId, myId, true);
		}

		stream.getVideoTracks().forEach((track) => {
			track.onended = () => {
				void stopScreenShareInternal(true);
			};
		});

		peerConnections.forEach((pc) => {
			stream.getTracks().forEach((track) => {
				pc.addTrack(track, stream);
			});
		});

		renegotiateAllPeers(channelId);

		websocket.send({
			type: 'VOICE_STATE_UPDATE',
			data: {
				channelId,
				isScreenSharing: true
			}
		});
	} catch (err: unknown) {
		if (err instanceof Error && err.name === 'NotAllowedError') {
			addToast({ type: 'error', message: 'Screen sharing permission was denied.' });
			return;
		}
		addToast({ type: 'error', message: 'Failed to start screen sharing.' });
	}
}

export async function stopScreenShare() {
	await stopScreenShareInternal(true);
}

export function toggleScreenShare() {
	if (get(isSelfScreenSharing)) {
		void stopScreenShare();
		return;
	}
	void startScreenShare();
}

// Load voice states for a channel (used in sidebar)
export async function loadVoiceStates(channelId: string) {
	try {
		const states = await api.getVoiceStates(channelId);
		voiceParticipants.update((p) => ({ ...p, [channelId]: states }));
	} catch {
		// Silently fail
	}
}

// Speaking detection threshold (0-255, lower = more sensitive)
const SPEAKING_THRESHOLD = 15;
const SPEAKING_CHECK_INTERVAL = 80; // ms

// Start monitoring audio levels for a user's stream
function startSpeakingDetection(userId: string, stream: MediaStream) {
	stopSpeakingDetection(userId);

	try {
		const ctx = new AudioContext();
		const source = ctx.createMediaStreamSource(stream);
		const analyser = ctx.createAnalyser();
		analyser.fftSize = 256;
		analyser.smoothingTimeConstant = 0.5;
		source.connect(analyser);

		const dataArray = new Uint8Array(analyser.frequencyBinCount);
		let wasSpeaking = false;

		const interval = setInterval(() => {
			analyser.getByteFrequencyData(dataArray);
			// Average the frequency data to get a rough volume level
			let sum = 0;
			for (let i = 0; i < dataArray.length; i++) {
				sum += dataArray[i];
			}
			const average = sum / dataArray.length;
			const isSpeaking = average > SPEAKING_THRESHOLD;

			if (isSpeaking !== wasSpeaking) {
				wasSpeaking = isSpeaking;
				speakingUsers.update((s) => ({ ...s, [userId]: isSpeaking }));
			}
		}, SPEAKING_CHECK_INTERVAL);

		audioAnalysers.set(userId, { analyser, interval });
	} catch {
		// AudioContext not available, skip speaking detection
	}
}

// Start monitoring the local microphone for speaking
function startLocalSpeakingDetection() {
	if (!localStream) return;
	const myId = get(currentUserId);
	if (!myId) return;

	stopSpeakingDetection(myId);

	try {
		localAudioContext = new AudioContext();
		const source = localAudioContext.createMediaStreamSource(localStream);
		const analyser = localAudioContext.createAnalyser();
		analyser.fftSize = 256;
		analyser.smoothingTimeConstant = 0.5;
		source.connect(analyser);

		const dataArray = new Uint8Array(analyser.frequencyBinCount);
		let wasSpeaking = false;

		const interval = setInterval(() => {
			// Don't show speaking if muted
			if (get(isSelfMuted)) {
				if (wasSpeaking) {
					wasSpeaking = false;
					speakingUsers.update((s) => ({ ...s, [myId]: false }));
				}
				return;
			}

			analyser.getByteFrequencyData(dataArray);
			let sum = 0;
			for (let i = 0; i < dataArray.length; i++) {
				sum += dataArray[i];
			}
			const average = sum / dataArray.length;
			const isSpeaking = average > SPEAKING_THRESHOLD;

			if (isSpeaking !== wasSpeaking) {
				wasSpeaking = isSpeaking;
				speakingUsers.update((s) => ({ ...s, [myId]: isSpeaking }));
			}
		}, SPEAKING_CHECK_INTERVAL);

		audioAnalysers.set(myId, { analyser, interval });
	} catch {
		// AudioContext not available
	}
}

function stopSpeakingDetection(userId: string) {
	const entry = audioAnalysers.get(userId);
	if (entry) {
		clearInterval(entry.interval);
		audioAnalysers.delete(userId);
	}
	speakingUsers.update((s) => {
		const next = { ...s };
		delete next[userId];
		return next;
	});
}

// Clean up voice state on page unload so the server doesn't keep stale entries after WS closes
if (typeof window !== 'undefined') {
	setupVoiceListeners();

	window.addEventListener('beforeunload', () => {
		const channelId = get(voiceChannelId);
		if (channelId) {
			// Use sendBeacon for a reliable fire-and-forget leave request
			// The WS close will also trigger server cleanup, but this is faster
			cleanupVoiceResources();
		}

		cleanupVoiceListeners();
	});
}
