CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: faq_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faq_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    psak_din_id uuid NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gemara_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gemara_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daf_number integer NOT NULL,
    sugya_id text NOT NULL,
    title text NOT NULL,
    daf_yomi text NOT NULL,
    sefaria_ref text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    masechet text DEFAULT 'Bava_Batra'::text NOT NULL
);


--
-- Name: modern_examples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modern_examples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sugya_id text NOT NULL,
    masechet text NOT NULL,
    daf_yomi text NOT NULL,
    principle text NOT NULL,
    examples jsonb DEFAULT '[]'::jsonb NOT NULL,
    practical_summary text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pattern_sugya_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pattern_sugya_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    psak_din_id uuid NOT NULL,
    sugya_id text NOT NULL,
    masechet text NOT NULL,
    daf text,
    amud text,
    source_text text NOT NULL,
    confidence text DEFAULT 'medium'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: psakei_din; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.psakei_din (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    court text NOT NULL,
    year integer NOT NULL,
    case_number text,
    summary text NOT NULL,
    full_text text,
    source_url text,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content_hash text
);


--
-- Name: smart_index_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.smart_index_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    psak_din_id uuid NOT NULL,
    sources jsonb DEFAULT '[]'::jsonb NOT NULL,
    topics jsonb DEFAULT '[]'::jsonb NOT NULL,
    masechtot text[] DEFAULT '{}'::text[] NOT NULL,
    books text[] DEFAULT '{}'::text[] NOT NULL,
    word_count integer DEFAULT 0 NOT NULL,
    has_full_text boolean DEFAULT false NOT NULL,
    analysis_method text DEFAULT 'pattern_matching'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sugya_psak_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sugya_psak_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sugya_id text NOT NULL,
    psak_din_id uuid NOT NULL,
    connection_explanation text NOT NULL,
    relevance_score integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sugya_psak_links_relevance_score_check CHECK (((relevance_score >= 1) AND (relevance_score <= 10)))
);


--
-- Name: text_annotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.text_annotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    start_offset integer NOT NULL,
    end_offset integer NOT NULL,
    original_text text NOT NULL,
    styles jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: upload_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id text NOT NULL,
    status text DEFAULT 'idle'::text NOT NULL,
    total_files integer DEFAULT 0 NOT NULL,
    processed_files integer DEFAULT 0 NOT NULL,
    successful_files integer DEFAULT 0 NOT NULL,
    failed_files integer DEFAULT 0 NOT NULL,
    skipped_files integer DEFAULT 0 NOT NULL,
    current_file text,
    device_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: faq_items faq_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_items
    ADD CONSTRAINT faq_items_pkey PRIMARY KEY (id);


--
-- Name: gemara_pages gemara_pages_masechet_daf_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gemara_pages
    ADD CONSTRAINT gemara_pages_masechet_daf_unique UNIQUE (masechet, daf_number);


--
-- Name: gemara_pages gemara_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gemara_pages
    ADD CONSTRAINT gemara_pages_pkey PRIMARY KEY (id);


--
-- Name: modern_examples modern_examples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modern_examples
    ADD CONSTRAINT modern_examples_pkey PRIMARY KEY (id);


--
-- Name: modern_examples modern_examples_sugya_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modern_examples
    ADD CONSTRAINT modern_examples_sugya_id_key UNIQUE (sugya_id);


--
-- Name: pattern_sugya_links pattern_sugya_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_sugya_links
    ADD CONSTRAINT pattern_sugya_links_pkey PRIMARY KEY (id);


--
-- Name: psakei_din psakei_din_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.psakei_din
    ADD CONSTRAINT psakei_din_pkey PRIMARY KEY (id);


--
-- Name: smart_index_results smart_index_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_index_results
    ADD CONSTRAINT smart_index_results_pkey PRIMARY KEY (id);


--
-- Name: smart_index_results smart_index_results_psak_din_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_index_results
    ADD CONSTRAINT smart_index_results_psak_din_id_key UNIQUE (psak_din_id);


--
-- Name: sugya_psak_links sugya_psak_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sugya_psak_links
    ADD CONSTRAINT sugya_psak_links_pkey PRIMARY KEY (id);


--
-- Name: sugya_psak_links sugya_psak_links_sugya_id_psak_din_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sugya_psak_links
    ADD CONSTRAINT sugya_psak_links_sugya_id_psak_din_id_key UNIQUE (sugya_id, psak_din_id);


--
-- Name: text_annotations text_annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.text_annotations
    ADD CONSTRAINT text_annotations_pkey PRIMARY KEY (id);


--
-- Name: text_annotations text_annotations_source_offset_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.text_annotations
    ADD CONSTRAINT text_annotations_source_offset_unique UNIQUE (source_type, source_id, start_offset, end_offset);


--
-- Name: upload_sessions upload_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_pkey PRIMARY KEY (id);


--
-- Name: upload_sessions upload_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_session_id_key UNIQUE (session_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_pattern_links_masechet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pattern_links_masechet ON public.pattern_sugya_links USING btree (masechet);


--
-- Name: idx_pattern_links_psak; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pattern_links_psak ON public.pattern_sugya_links USING btree (psak_din_id);


--
-- Name: idx_pattern_links_sugya; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pattern_links_sugya ON public.pattern_sugya_links USING btree (sugya_id);


--
-- Name: idx_psakei_din_content_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psakei_din_content_hash ON public.psakei_din USING btree (content_hash);


--
-- Name: idx_psakei_din_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psakei_din_tags ON public.psakei_din USING gin (tags);


--
-- Name: idx_psakei_din_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_psakei_din_year ON public.psakei_din USING btree (year);


--
-- Name: idx_smart_index_books; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_index_books ON public.smart_index_results USING gin (books);


--
-- Name: idx_smart_index_masechtot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_smart_index_masechtot ON public.smart_index_results USING gin (masechtot);


--
-- Name: idx_sugya_psak_links_psak_din_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sugya_psak_links_psak_din_id ON public.sugya_psak_links USING btree (psak_din_id);


--
-- Name: idx_sugya_psak_links_sugya_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sugya_psak_links_sugya_id ON public.sugya_psak_links USING btree (sugya_id);


--
-- Name: idx_text_annotations_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_text_annotations_source ON public.text_annotations USING btree (source_type, source_id);


--
-- Name: idx_text_annotations_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_text_annotations_unique ON public.text_annotations USING btree (source_type, source_id, start_offset, end_offset);


--
-- Name: faq_items update_faq_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_faq_items_updated_at BEFORE UPDATE ON public.faq_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: gemara_pages update_gemara_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_gemara_pages_updated_at BEFORE UPDATE ON public.gemara_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: modern_examples update_modern_examples_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_modern_examples_updated_at BEFORE UPDATE ON public.modern_examples FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: psakei_din update_psakei_din_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_psakei_din_updated_at BEFORE UPDATE ON public.psakei_din FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: smart_index_results update_smart_index_results_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_smart_index_results_updated_at BEFORE UPDATE ON public.smart_index_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: upload_sessions update_upload_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_upload_sessions_updated_at BEFORE UPDATE ON public.upload_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: faq_items faq_items_psak_din_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_items
    ADD CONSTRAINT faq_items_psak_din_id_fkey FOREIGN KEY (psak_din_id) REFERENCES public.psakei_din(id) ON DELETE CASCADE;


--
-- Name: pattern_sugya_links pattern_sugya_links_psak_din_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pattern_sugya_links
    ADD CONSTRAINT pattern_sugya_links_psak_din_id_fkey FOREIGN KEY (psak_din_id) REFERENCES public.psakei_din(id) ON DELETE CASCADE;


--
-- Name: smart_index_results smart_index_results_psak_din_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.smart_index_results
    ADD CONSTRAINT smart_index_results_psak_din_id_fkey FOREIGN KEY (psak_din_id) REFERENCES public.psakei_din(id) ON DELETE CASCADE;


--
-- Name: sugya_psak_links sugya_psak_links_psak_din_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sugya_psak_links
    ADD CONSTRAINT sugya_psak_links_psak_din_id_fkey FOREIGN KEY (psak_din_id) REFERENCES public.psakei_din(id) ON DELETE CASCADE;


--
-- Name: upload_sessions upload_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_sessions
    ADD CONSTRAINT upload_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles Admins can manage roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: psakei_din Allow delete psakei din; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete psakei din" ON public.psakei_din FOR DELETE USING (true);


--
-- Name: sugya_psak_links Allow delete sugya psak links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow delete sugya psak links" ON public.sugya_psak_links FOR DELETE USING (true);


--
-- Name: psakei_din Allow insert to psakei din; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert to psakei din" ON public.psakei_din FOR INSERT WITH CHECK (true);


--
-- Name: sugya_psak_links Allow insert to sugya psak links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow insert to sugya psak links" ON public.sugya_psak_links FOR INSERT WITH CHECK (true);


--
-- Name: psakei_din Allow update psakei din; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow update psakei din" ON public.psakei_din FOR UPDATE USING (true);


--
-- Name: pattern_sugya_links Anyone can delete pattern sugya links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete pattern sugya links" ON public.pattern_sugya_links FOR DELETE USING (true);


--
-- Name: smart_index_results Anyone can delete smart index results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete smart index results" ON public.smart_index_results FOR DELETE USING (true);


--
-- Name: text_annotations Anyone can delete text annotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete text annotations" ON public.text_annotations FOR DELETE USING (true);


--
-- Name: modern_examples Anyone can insert modern examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert modern examples" ON public.modern_examples FOR INSERT WITH CHECK (true);


--
-- Name: pattern_sugya_links Anyone can insert pattern sugya links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert pattern sugya links" ON public.pattern_sugya_links FOR INSERT WITH CHECK (true);


--
-- Name: smart_index_results Anyone can insert smart index results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert smart index results" ON public.smart_index_results FOR INSERT WITH CHECK (true);


--
-- Name: text_annotations Anyone can insert text annotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert text annotations" ON public.text_annotations FOR INSERT WITH CHECK (true);


--
-- Name: modern_examples Anyone can update modern examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update modern examples" ON public.modern_examples FOR UPDATE USING (true);


--
-- Name: smart_index_results Anyone can update smart index results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update smart index results" ON public.smart_index_results FOR UPDATE USING (true);


--
-- Name: text_annotations Anyone can update text annotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update text annotations" ON public.text_annotations FOR UPDATE USING (true);


--
-- Name: faq_items Anyone can view FAQ items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view FAQ items" ON public.faq_items FOR SELECT USING (true);


--
-- Name: gemara_pages Anyone can view gemara pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view gemara pages" ON public.gemara_pages FOR SELECT USING (true);


--
-- Name: modern_examples Anyone can view modern examples; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view modern examples" ON public.modern_examples FOR SELECT USING (true);


--
-- Name: pattern_sugya_links Anyone can view pattern sugya links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view pattern sugya links" ON public.pattern_sugya_links FOR SELECT USING (true);


--
-- Name: psakei_din Anyone can view psakei din; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view psakei din" ON public.psakei_din FOR SELECT USING (true);


--
-- Name: smart_index_results Anyone can view smart index results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view smart index results" ON public.smart_index_results FOR SELECT USING (true);


--
-- Name: sugya_psak_links Anyone can view sugya-psak links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view sugya-psak links" ON public.sugya_psak_links FOR SELECT USING (true);


--
-- Name: text_annotations Anyone can view text annotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view text annotations" ON public.text_annotations FOR SELECT USING (true);


--
-- Name: upload_sessions Users can create their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own sessions" ON public.upload_sessions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: upload_sessions Users can delete their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own sessions" ON public.upload_sessions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: upload_sessions Users can update their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own sessions" ON public.upload_sessions FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: upload_sessions Users can view their own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own sessions" ON public.upload_sessions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: faq_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

--
-- Name: gemara_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gemara_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: modern_examples; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modern_examples ENABLE ROW LEVEL SECURITY;

--
-- Name: pattern_sugya_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pattern_sugya_links ENABLE ROW LEVEL SECURITY;

--
-- Name: psakei_din; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.psakei_din ENABLE ROW LEVEL SECURITY;

--
-- Name: smart_index_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.smart_index_results ENABLE ROW LEVEL SECURITY;

--
-- Name: sugya_psak_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sugya_psak_links ENABLE ROW LEVEL SECURITY;

--
-- Name: text_annotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.text_annotations ENABLE ROW LEVEL SECURITY;

--
-- Name: upload_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


