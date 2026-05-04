export function generateMultipageAuditExport(protocol) {
  const ocr = protocol.ocr || {};
  const pageAssociation = protocol.page_system_measure_associations || {};
  const textBlocks = Array.isArray(ocr.text_blocks) ? ocr.text_blocks : [];
  const pages = Array.isArray(ocr.pages) ? ocr.pages : [];
  const associations = Array.isArray(pageAssociation.associations) ? pageAssociation.associations : [];

  return {
    export_type: "cpp_multipage_audit_export",
    version: "audit-49",
    generated_at: new Date().toISOString(),
    source: {
      file_name: protocol.source?.file_name || "",
      file_type: protocol.source?.file_type || "",
      omr_status: protocol.source?.omr_status || "",
      ocr_status: protocol.source?.ocr_status || ocr.status || "",
      ocr_engine: protocol.source?.ocr_engine || ocr.engine || "",
    },
    multipage_summary: {
      multipage_status: ocr.multipage_status || "not_processed",
      page_count: Number(ocr.page_count || 0),
      ocr_text_block_count: textBlocks.length,
      association_status: pageAssociation.status || "not_available",
      association_page_count: Number(pageAssociation.page_count || 0),
      association_blocked_count: Number(pageAssociation.blocked_count || 0),
      association_unassigned_count: Number(pageAssociation.unassigned_count || 0),
      association_assigned_count: Number(pageAssociation.assigned_count || 0),
    },
    pages: pages.map(page => pageAuditEntry(page, textBlocks, associations)),
    warnings: {
      ocr: Array.isArray(ocr.warnings) ? ocr.warnings : [],
      page_system_measure_associations: Array.isArray(pageAssociation.warnings) ? pageAssociation.warnings : [],
    },
    conservative_rules: [
      "Não inventar OCR.",
      "Não inventar letra.",
      "Não inferir harmonia.",
      "Não associar página→sistema automaticamente sem geometria confiável.",
      "Não associar página→compasso automaticamente sem geometria confiável.",
      "Preservar text_blocks[].page como evidência de origem.",
    ],
  };
}

export function generateMultipageAuditExportText(protocol) {
  return JSON.stringify(generateMultipageAuditExport(protocol), null, 2);
}

function pageAuditEntry(page, textBlocks, associations) {
  const pageNumber = Number(page.page || 1);
  const pageBlocks = textBlocks.filter(block => Number(block.page || 1) === pageNumber);
  const association = associations.find(item => Number(item.page || 1) === pageNumber) || null;

  return {
    page: pageNumber,
    ocr_status: page.ocr_status || "unknown",
    text_block_count: Number(page.text_block_count || pageBlocks.length || 0),
    text_blocks: pageBlocks.map(block => ({
      text: block.text || "",
      normalized_text: block.normalized_text || "",
      classification: block.classification || "",
      bbox: block.bbox || null,
      confidence: block.confidence ?? null,
      source: block.source || "ocr",
    })),
    page_system_measure_association: association ? {
      association_status: association.association_status || "unknown",
      confidence_score: association.confidence_score ?? 0,
      confidence_level: association.confidence_level || "none",
      system_count: Number(association.system_count || 0),
      reliable_system_count: Number(association.reliable_system_count || 0),
      measure_count: Number(association.measure_count || 0),
      reliable_measure_count: Number(association.reliable_measure_count || 0),
      candidate_system_ids: association.candidate_system_ids || [],
      candidate_measure_ids: association.candidate_measure_ids || [],
      reason: association.reason || "",
    } : {
      association_status: "missing_association_entry",
      confidence_score: 0,
      confidence_level: "blocked",
      reason: "Nenhuma entrada página→sistema→compasso disponível para esta página.",
    },
  };
}
