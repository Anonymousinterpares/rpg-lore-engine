 Biome Population Logic (English Explanation)

Natural Rarity: 
Each biome has a Base Weight. For example, Plains (25) and Forest (20) are much more common "defaults" than Swamps (8) or Deserts (5).

Neighborhood Synergy (Clustering): 
When a new hex is born, it "sniffs" its neighbors. If a neighbor is a Desert, the engine adds a massive +40 weight to the chance of the new hex also being a Desert. This ensures you get realistic, contiguous biomes instead of a random checkerboard.

Expansion Control:
To prevent the whole map from becoming a single giant forest, every biome has a Max Cluster Size. If the engine sees a cluster is getting too big, it applies a Cluster Penalty (cutting the weight by 20% to 50%) to force a transition into a new biome type.

Resource Seeding:
Once the biome is "decided," the game rolls against a Resource Table specific to that biome (e.g., Mountains roll for Iron/Gold, Swamps roll for Bogbean/Nightshade).