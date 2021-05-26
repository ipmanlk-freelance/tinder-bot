import {
	Client,
	EmojiResolvable,
	MessageReaction,
	PartialUser,
	Snowflake,
	User,
} from "discord.js";
import EventEmitter from "events";

interface ReactionRoleConfig {
	messageId: Snowflake;
	roleId: Snowflake;
	reaction: EmojiResolvable;
	unique: boolean;
}

type SuccessEvents = "roleAdd" | "roleRemove";
type ErrorEvents = "hasUniqueRole" | "error";

export class ReactionRole extends EventEmitter {
	private reactionRoleConfig: ReactionRoleConfig[];
	private uniqueRoleIds: Array<Snowflake> = [];
	private client: Client;

	constructor(client: Client, config: ReactionRoleConfig[]) {
		super();
		this.client = client;
		this.reactionRoleConfig = config;
		config.forEach((r) =>
			r.unique ? this.uniqueRoleIds.push(r.roleId) : false
		);

		this.addReaction = this.addReaction.bind(this);
		this.removeReaction = this.removeReaction.bind(this);

		this.client.on("messageReactionAdd", this.addReaction);
		this.client.on("messageReactionRemove", this.removeReaction);
	}

	private async addReaction(
		reaction: MessageReaction,
		user: User | PartialUser
	) {
		try {
			// ignore non guild msgs
			if (!reaction.message.guild) return;

			// ignore self reactions
			if (user.id === this.client.user?.id) {
				return;
			}

			// get the reacted member
			const member = await reaction.message.guild.members.fetch(user.id);
			if (!member) return;

			const roleInfo = await this.extractRole(reaction);
			if (!roleInfo) return;

			// check unique role
			if (roleInfo.unique) {
				let uniqueRole;
				member.roles.cache.every((r) => {
					if (this.uniqueRoleIds.includes(r.id)) {
						uniqueRole = r;
						return false;
					}
					return false;
				});

				if (uniqueRole) {
					this.emit("hasUniqueRole" as ErrorEvents, [
						member,
						uniqueRole,
						this.uniqueRoleIds,
					]);
					return;
				}
			}

			await member.roles.add(roleInfo.role);
			this.emit("roleAdd" as SuccessEvents, [member, roleInfo.role]);
		} catch (e) {
			this.emit("error" as ErrorEvents, [{ error: e }]);
		}
	}

	private async removeReaction(
		reaction: MessageReaction,
		user: User | PartialUser
	) {
		try {
			// ignore non guild msgs
			if (!reaction.message.guild) return;

			// ignore self reactions
			if (user.id === this.client.user?.id) {
				return;
			}

			// get the reacted member
			const member = await reaction.message.guild.members.fetch(user.id);
			if (!member) return;

			const roleInfo = await this.extractRole(reaction);
			if (!roleInfo) return;

			await member.roles.remove(roleInfo.role);
			this.emit("roleRemove" as SuccessEvents, [member, roleInfo.role]);
		} catch (e) {
			this.emit("error" as ErrorEvents, [{ error: e }]);
		}
	}

	private async extractRole(reaction: MessageReaction) {
		const messageId = reaction.message.id;
		const reactionName = reaction.emoji.name;
		const guild = reaction.message.guild;

		const reactionConfig = this.reactionRoleConfig.find((r) => {
			return r.messageId == messageId && r.reaction == reactionName;
		});

		if (!reactionConfig || !guild) return false;

		const role = await guild.roles.fetch(reactionConfig.roleId);

		if (!role) return false;

		return {
			role: role,
			unique: reactionConfig.unique,
		};
	}
}
