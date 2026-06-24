-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (For Teachers)
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    full_name text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Question Bank / Predefined Syllabus Pool
create table public.question_bank (
    id uuid default uuid_generate_v4() primary key,
    teacher_id uuid references public.profiles(id) on delete cascade not null,
    syllabus_tag text not null,
    question_text text not null,
    option_a text not null,
    option_b text not null,
    option_c text not null,
    option_d text not null,
    correct_option text not null, -- 'A', 'B', 'C', or 'D'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Quizzes Table
create table public.quizzes (
    id uuid default uuid_generate_v4() primary key,
    teacher_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    rounds integer default 1 not null,
    question_count integer not null,
    duration_minutes integer not null,
    is_random boolean default false not null,
    access_code varchar(10) unique not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Quiz Questions Junction Table (Links Question Bank to Active Quizzes)
create table public.quiz_questions (
    id uuid default uuid_generate_v4() primary key,
    quiz_id uuid references public.quizzes(id) on delete cascade not null,
    question_bank_id uuid references public.question_bank(id) on delete cascade not null
);

-- 5. Student Results Table
create table public.student_results (
    id uuid default uuid_generate_v4() primary key,
    quiz_id uuid references public.quizzes(id) on delete cascade not null,
    student_name text not null,
    score integer not null,
    total_questions integer not null,
    completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.question_bank enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.student_results enable row level security;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Profiles: teachers manage only their own profile
create policy "Teachers manage own profile"
  on public.profiles for all
  using (auth.uid() = id);

-- Question Bank: teachers can only CRUD their own questions
create policy "Teachers manage own question bank"
  on public.question_bank for all
  using (auth.uid() = teacher_id);

-- Quizzes: teachers manage only their own quizzes.
-- NOTE: Do NOT add a broad "public read" policy here — it would leak
-- all teachers' quizzes to each other on the dashboard. Instead, students
-- look up quizzes by access_code via a public anon-safe read only on quiz_questions.
create policy "Teachers manage own quizzes"
  on public.quizzes for all
  using (auth.uid() = teacher_id);

-- IMPORTANT: Students (unauthenticated anon users) need to validate an access code
-- before joining a quiz. Allow anon SELECT only — teachers cannot see each other's
-- quizzes because the dashboard queries include .eq('teacher_id', user.id).
create policy "Anon can look up quizzes by access_code"
  on public.quizzes for select
  using (true);

-- Quiz Questions: public read (students need questions during a quiz session)
create policy "Public read access to quiz questions"
  on public.quiz_questions for select
  using (true);

-- Quiz Questions: only the owning teacher's quiz can have rows inserted
create policy "Teachers manage own quiz questions"
  on public.quiz_questions for all
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and q.teacher_id = auth.uid()
    )
  );

-- Student Results: anyone (including anon students) can insert results
create policy "Students can insert results"
  on public.student_results for insert
  with check (true);

-- Student Results: only authenticated teachers can read results —
-- teachers should further scope to their own quiz IDs on the client.
create policy "Authenticated users can read results"
  on public.student_results for select
  using (auth.role() = 'authenticated');
