import AdmZip from 'adm-zip';

export interface ParsedSkill {
  name: string;
  description: string;
  domain: string;
  version: string;
  instructions: string;
  tools: any[];
  output_schema: any;
  raw_files?: Record<string, string>; // For normalization if needed
}

export const SkillImporter = {
  parseZip: (buffer: Buffer): ParsedSkill => {
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    let skillData: any = {};
    let instructions = "";
    let tools: any[] = [];
    let schema: any = { type: "object", properties: { result: { type: "string" } } }; // Default
    const rawFiles: Record<string, string> = {};

    // Helper to find file by name (case insensitive)
    // GitHub zips have a root folder, so we search recursively or ignore path prefix
    const findEntry = (name: string) => zipEntries.find(entry => entry.entryName.toLowerCase().endsWith(name.toLowerCase()) && !entry.isDirectory);

    // Collect all text files for normalization context
    zipEntries.forEach(entry => {
      if (!entry.isDirectory && !entry.entryName.includes('__MACOSX') && !entry.entryName.includes('.DS_Store')) {
        const content = entry.getData().toString('utf8');
        // Store with relative path (strip root folder if present)
        const pathParts = entry.entryName.split('/');
        const relPath = pathParts.length > 1 ? pathParts.slice(1).join('/') : entry.entryName;
        rawFiles[relPath] = content;
      }
    });

    // 1. Parse metadata (skill.json or metadata.json)
    const metadataEntry = findEntry('skill.json') || findEntry('metadata.json');
    if (metadataEntry) {
      try {
        skillData = JSON.parse(metadataEntry.getData().toString('utf8'));
      } catch (e) {
        // Invalid JSON, but maybe we can normalize later
        console.warn('Invalid JSON in skill.json/metadata.json');
      }
    }

    // 2. Parse instructions.md
    const instructionsEntry = findEntry('instructions.md');
    if (instructionsEntry) {
      instructions = instructionsEntry.getData().toString('utf8');
    }

    // 3. Parse tools.json
    const toolsEntry = findEntry('tools.json');
    if (toolsEntry) {
      try {
        tools = JSON.parse(toolsEntry.getData().toString('utf8'));
      } catch (e) {
        console.warn('Invalid JSON in tools.json, using empty array');
      }
    }

    // 4. Parse schema.json
    const schemaEntry = findEntry('schema.json');
    if (schemaEntry) {
      try {
        schema = JSON.parse(schemaEntry.getData().toString('utf8'));
      } catch (e) {
        console.warn('Invalid JSON in schema.json, using default');
      }
    }

    // Return what we found, even if incomplete. Normalizer will fix it.
    return {
      name: skillData.name || '',
      description: skillData.description || '',
      domain: skillData.domain || 'General',
      version: skillData.version || '1.0.0',
      instructions: instructions || skillData.instructions || '',
      tools: tools,
      output_schema: schema,
      raw_files: rawFiles
    };
  }
};

export const GitHubImporter = {
  fetchRepo: async (url: string, branch: string = 'main'): Promise<Buffer> => {
    // Parse URL to get owner/repo
    // Supports: https://github.com/owner/repo
    const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = url.match(regex);
    if (!match) {
      throw new Error("Invalid GitHub URL");
    }
    const owner = match[1];
    const repo = match[2].replace('.git', '');

    // Download Zipball
    const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;
    
    const response = await fetch(zipUrl, {
      headers: {
        'User-Agent': 'AI-Studio-Skill-Importer'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub repo: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
};
