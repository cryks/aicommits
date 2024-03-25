import fs from "fs/promises";
import path from "path";
import os from "os";
import ini from "ini";
import { fileExists } from "./fs.js";
import { KnownError } from "./error.js";

const commitTypes = ["", "conventional"] as const;

export type CommitType = (typeof commitTypes)[number];

const { hasOwnProperty } = Object.prototype;
export const hasOwn = (object: unknown, key: PropertyKey) =>
	hasOwnProperty.call(object, key);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseAssert = (name: string, condition: any, message: string) => {
	if (!condition) {
		throw new KnownError(`Invalid config property ${name}: ${message}`);
	}
};

const configParsers = {
	generate(count?: string) {
		if (!count) {
			return 1;
		}

		parseAssert("generate", /^\d+$/.test(count), "Must be an integer");

		const parsed = Number(count);
		parseAssert("generate", parsed > 0, "Must be greater than 0");
		parseAssert("generate", parsed <= 30, "Must be less or equal to 30");

		return parsed;
	},
	"max-length"(maxLength?: string) {
		if (!maxLength) {
			return 50;
		}

		parseAssert("max-length", /^\d+$/.test(maxLength), "Must be an integer");

		const parsed = Number(maxLength);
		parseAssert(
			"max-length",
			parsed >= 20,
			"Must be greater than 20 characters"
		);

		return parsed;
	},
} as const;

type ConfigKeys = keyof typeof configParsers;

type RawConfig = {
	[key in ConfigKeys]?: string;
};

export type ValidConfig = {
	[Key in ConfigKeys]: ReturnType<(typeof configParsers)[Key]>;
};

const configPath = path.join(os.homedir(), ".aicommits");

const readConfigFile = async (): Promise<RawConfig> => {
	const configExists = await fileExists(configPath);
	if (!configExists) {
		return Object.create(null);
	}

	const configString = await fs.readFile(configPath, "utf8");
	return ini.parse(configString);
};

export const getConfig = async (
	cliConfig?: RawConfig,
	suppressErrors?: boolean
): Promise<ValidConfig> => {
	const config = await readConfigFile();
	const parsedConfig: Record<string, unknown> = {};

	for (const key of Object.keys(configParsers) as ConfigKeys[]) {
		const parser = configParsers[key];
		const value = cliConfig?.[key] ?? config[key];

		if (suppressErrors) {
			try {
				parsedConfig[key] = parser(value);
			} catch {
				/* empty */
			}
		} else {
			parsedConfig[key] = parser(value);
		}
	}

	return parsedConfig as ValidConfig;
};

export const setConfigs = async (keyValues: [key: string, value: string][]) => {
	const config = await readConfigFile();

	for (const [key, value] of keyValues) {
		if (!hasOwn(configParsers, key)) {
			throw new KnownError(`Invalid config property: ${key}`);
		}

		const parsed = configParsers[key as ConfigKeys](value);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		config[key as ConfigKeys] = parsed as any;
	}

	await fs.writeFile(configPath, ini.stringify(config), "utf8");
};
