-- טבלה לאחסון מסמכים (פסקי דין)
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- טבלה לאחסון מסכתות הש"ס
CREATE TABLE public.tractates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_english TEXT,
  order_num INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- טבלה לאחסון מראי מקומות שנמצאו
CREATE TABLE public.source_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tractate_id UUID NOT NULL REFERENCES public.tractates(id),
  daf_number INTEGER NOT NULL,
  amud TEXT NOT NULL CHECK (amud IN ('א', 'ב')),
  original_text TEXT NOT NULL,
  context TEXT,
  position_in_doc INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- טבלה לאינדקסים מותאמים אישית
CREATE TABLE public.custom_indexes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- טבלת קישור בין אינדקסים למראי מקומות
CREATE TABLE public.index_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  index_id UUID NOT NULL REFERENCES public.custom_indexes(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES public.source_references(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(index_id, reference_id)
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tractates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_references ENABLE ROW LEVEL SECURITY;

-- Public read access for tractates (reference data)
CREATE POLICY "Anyone can view tractates" 
ON public.tractates 
FOR SELECT 
USING (true);

-- Public access for documents (no auth required for this app)
CREATE POLICY "Anyone can view documents" 
ON public.documents 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update documents" 
ON public.documents 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete documents" 
ON public.documents 
FOR DELETE 
USING (true);

-- Public access for source_references
CREATE POLICY "Anyone can view source_references" 
ON public.source_references 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create source_references" 
ON public.source_references 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete source_references" 
ON public.source_references 
FOR DELETE 
USING (true);

-- Public access for custom_indexes
CREATE POLICY "Anyone can view custom_indexes" 
ON public.custom_indexes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create custom_indexes" 
ON public.custom_indexes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update custom_indexes" 
ON public.custom_indexes 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete custom_indexes" 
ON public.custom_indexes 
FOR DELETE 
USING (true);

-- Public access for index_references
CREATE POLICY "Anyone can view index_references" 
ON public.index_references 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create index_references" 
ON public.index_references 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete index_references" 
ON public.index_references 
FOR DELETE 
USING (true);

-- Indexes for better performance
CREATE INDEX idx_source_references_document ON public.source_references(document_id);
CREATE INDEX idx_source_references_tractate ON public.source_references(tractate_id);
CREATE INDEX idx_source_references_daf ON public.source_references(tractate_id, daf_number, amud);
CREATE INDEX idx_index_references_index ON public.index_references(index_id);

-- Insert all tractates of the Talmud Bavli
INSERT INTO public.tractates (name, name_english, order_num) VALUES
('ברכות', 'Berachot', 1),
('שבת', 'Shabbat', 2),
('עירובין', 'Eruvin', 3),
('פסחים', 'Pesachim', 4),
('שקלים', 'Shekalim', 5),
('יומא', 'Yoma', 6),
('סוכה', 'Sukkah', 7),
('ביצה', 'Beitzah', 8),
('ראש השנה', 'Rosh Hashanah', 9),
('תענית', 'Taanit', 10),
('מגילה', 'Megillah', 11),
('מועד קטן', 'Moed Katan', 12),
('חגיגה', 'Chagigah', 13),
('יבמות', 'Yevamot', 14),
('כתובות', 'Ketubot', 15),
('נדרים', 'Nedarim', 16),
('נזיר', 'Nazir', 17),
('סוטה', 'Sotah', 18),
('גיטין', 'Gittin', 19),
('קידושין', 'Kiddushin', 20),
('בבא קמא', 'Bava Kamma', 21),
('בבא מציעא', 'Bava Metzia', 22),
('בבא בתרא', 'Bava Batra', 23),
('סנהדרין', 'Sanhedrin', 24),
('מכות', 'Makkot', 25),
('שבועות', 'Shevuot', 26),
('עבודה זרה', 'Avodah Zarah', 27),
('הוריות', 'Horayot', 28),
('זבחים', 'Zevachim', 29),
('מנחות', 'Menachot', 30),
('חולין', 'Chullin', 31),
('בכורות', 'Bechorot', 32),
('ערכין', 'Arachin', 33),
('תמורה', 'Temurah', 34),
('כריתות', 'Keritot', 35),
('מעילה', 'Meilah', 36),
('תמיד', 'Tamid', 37),
('נדה', 'Niddah', 38);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);

-- Storage policies
CREATE POLICY "Anyone can upload documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Anyone can view documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'documents');

CREATE POLICY "Anyone can delete documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'documents');