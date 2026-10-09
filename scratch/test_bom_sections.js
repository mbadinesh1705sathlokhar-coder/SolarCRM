const { ProjectMaster } = require('../server/models/ProjectMaster');

ProjectMaster.findOne({ where: { siteId: 'SP425' } }).then(p => {
  const data = p.toJSON();
  const formBomItems = JSON.parse(data.bomItems);
  
  function getGroupTheme(groupName) {
    const norm = (groupName || '').toLowerCase().trim();
    if (norm.includes('cable') || norm.includes('wire')) return { bg: '#f0f9ff' };
    return { bg: '#f8fafc' };
  }

  function getGroupedBomSections() {
    if (!formBomItems || formBomItems.length === 0) return [];

    const groupMap = new Map();
    formBomItems.forEach((item, index) => {
      const grp = (item.materialGroup || '').trim() || 'Custom / Unassigned';
      if (!groupMap.has(grp)) {
        groupMap.set(grp, []);
      }
      groupMap.get(grp).push({ item, originalIndex: index });
    });

    const sections = [];
    let grpIdx = 1;

    for (const [groupName, itemsWithIdx] of groupMap.entries()) {
      const sectionItems = itemsWithIdx.map((entry, subIdx) => ({
        item: entry.item,
        originalIndex: entry.originalIndex,
        subIndex: `${grpIdx}.${subIdx + 1}`
      }));

      const subtotalBase = sectionItems.reduce((acc, it) => acc + (Number(it.item.estimatedTotalCost) || 0), 0);
      const subtotalGst = sectionItems.reduce((acc, it) => acc + (Number(it.item.gstAmount) || 0), 0);
      const subtotalTotal = sectionItems.reduce((acc, it) => acc + (Number(it.item.estAmount !== undefined ? it.item.estAmount : ((Number(it.item.estimatedTotalCost) || 0) + (Number(it.item.gstAmount) || 0))) || 0), 0);

      sections.push({
        groupIndex: grpIdx,
        groupName: groupName,
        theme: getGroupTheme(groupName),
        items: sectionItems,
        subtotalBase,
        subtotalGst,
        subtotalTotal
      });
      grpIdx++;
    }

    return sections;
  }

  const sections = getGroupedBomSections();
  console.log('Sections created:', sections.length);
  sections.forEach(s => console.log(s.groupIndex, s.groupName, s.items.length, 'items'));
  process.exit(0);
});
