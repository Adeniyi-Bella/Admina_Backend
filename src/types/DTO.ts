export type OcrDetectionLanguage = 'af' | 'ast' | 'bi' | 'br' | 'ca' | 'ceb' | 'ch' | 'co' | 'crh' | 'cs' | 'csb' | 'da' | 'de' | 'en' | 'es' | 'et' | 'eu' | 'fi' | 'fil' | 'fj' | 'fr' | 'fur' | 'fy' | 'ga' | 'gd' | 'gil' | 'gl' | 'gv' | 'hni' | 'hsb' | 'ht' | 'hu' | 'ia' | 'id' | 'it' | 'iu' | 'ja' | 'jv' | 'kaa' | 'kac' | 'kea' | 'kha' | 'kl' | 'ko' | 'ku' | 'kw' | 'lb' | 'ms' | 'mww' | 'nap' | 'nl' | 'no' | 'oc' | 'pl' | 'pt' | 'quc' | 'rm' | 'sco' | 'sl' | 'sq' | 'sv' | 'sw' | 'tet' | 'tr' | 'tt' | 'uz' | 'vo' | 'wae' | 'yua' | 'za' | 'zh-Hans' | 'zh-Hant' | 'zu';

export interface ExtractTextReqDTO {
  file: Express.Multer.File | undefined;
  docLanguage: OcrDetectionLanguage;
  plan: string; 
}
export interface ExtractTextResDTO {
  text: string;
  // structuredPages: string; 
}

export interface IDocumentResponseFreeUsersDTO {
  receivedDate?: Date;
  docId: string;
  title?: string;
  sender?: string;
  structuredTranslatedText?: Record<string, string>;
  pdfBlobStorage?: boolean;
}

export interface IActionPlanPreview {
  title?: string;
  dueDate?: string | Date;
  completed?: boolean;
  location?: string;
}

export interface IDocumentPreview {
  docId: string;
  title?: string;
  sender?: string;
  receivedDate?: Date;
  actionPlans?: IActionPlanPreview[];
}