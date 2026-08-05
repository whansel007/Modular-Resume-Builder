# Demo Guide & Mock Job Descriptions

Everything you need to showcase the Modular Resume Builder — a seeded demo
account, a guided tour of the features, and three mock job descriptions tuned
to demo the AI keyword extraction and autofill.

## Demo account

| Field    | Value               |
| -------- | ------------------- |
| Email    | `demo@example.com`  |
| Password | `demopass123`       |

Re-seed (or reset) the account at any time with the API server running:

```bash
node server/seed-demo.js
```

### What's in the account

- **13 blocks** — 3 summaries, 4 experience roles, 2 education entries,
  4 skill groups. Each block is tagged with job types so the library filters
  have something to show.
- **3 resumes**, each demonstrating a different state:
  - **Jordan Avery — Master** — fully composed across all four sections.
    Use it to show drag & drop reordering, block editing, and PDF export.
  - **Starter — tailor me with AI** — only a Summary section. This is the
    one to use for the AI autofill demo below.
  - **Blank canvas** — empty resume to show building from scratch.

## Feature walkthrough

1. **Log in** with the demo account, land on the Dashboard with three resumes.
2. Open **Jordan Avery — Master**:
   - Drag blocks between sections and reorder them inside a section.
   - Drag a block out of the canvas back into the library to remove it.
   - Click a block to open its editor and tweak fields live.
3. **AI autofill** — open **Starter — tailor me with AI**:
   - Open the **Job Description** tab and paste one of the job descriptions
     below.
   - Click **Extract keywords** — the AI returns the key skills and terms.
   - Tick the keywords you want to target.
   - Click **Auto-fill resume** — the AI selects the best-fitting *existing*
     blocks for the missing sections (it never invents content), and the
     canvas fills in with the right experience, education, and skills for that
     specific job.
   - Try a second job description on a fresh copy and show how different
     blocks get picked for a different role.
4. **AI chat** — use the floating chat to ask questions about the resume
   against the pasted job description.
5. **Export** — print/export the Master resume to PDF and show the clean,
   UI-free output.

## Mock job descriptions

### JD 1 — Senior Full-Stack Engineer, Meridian Pay

> Expected picks: the *Senior Full-Stack Engineer* summary, the Northwind Labs
> and Studio Meridian roles, and the Frontend / Backend & Cloud skill blocks.

```
Senior Full-Stack Engineer — Meridian Pay (Fintech), Seattle, WA (Hybrid)

Meridian Pay is rebuilding the core of our payments platform and we need a
senior full-stack engineer who can own features end to end.

What you'll do:
- Design and build services in Node.js and TypeScript backed by PostgreSQL
- Ship rich, accessible interfaces with React on a modern component system
- Define and maintain REST APIs consumed by web and mobile clients
- Raise the bar on quality: automated testing, code review, and CI/CD with
  GitHub Actions
- Deploy and operate services on AWS (EC2, S3, Lambda, RDS) using Docker

What we're looking for:
- 5+ years building production web applications with JavaScript/TypeScript
- Strong experience with React, Node.js, and relational databases
  (PostgreSQL preferred)
- Working knowledge of AWS, Docker, and continuous integration pipelines
- Familiarity with accessibility standards (WCAG) and frontend testing
  tools such as Jest or Cypress
- Bonus: fintech or payments experience, and experience mentoring other
  engineers
```

### JD 2 — Data Engineer, Northlight Health

> Expected picks: the *Data-Focused Software Engineer* summary, the
> Brightline Analytics Data Engineer role, and the Data Engineering skills.

```
Data Engineer — Northlight Health Analytics, Portland, OR (Remote-friendly)

Northlight Health turns clinical data into decisions. As a Data Engineer
you'll build the pipelines that make that possible.

What you'll do:
- Build and maintain batch and streaming ETL/ELT pipelines in Python and SQL
- Orchestrate workflows with Apache Airflow and monitor data quality
- Model dimensional schemas in our cloud data warehouse
- Write dbt transformations with tests and documentation
- Process large-scale event data with Apache Spark
- Partner with analysts and data scientists to publish reliable datasets

What we're looking for:
- 3+ years in data engineering or analytics engineering
- Expert SQL and strong Python (Pandas a plus)
- Hands-on experience with Airflow, dbt, and modern warehouse platforms
  (Snowflake, BigQuery, or Redshift)
- Understanding of data modeling and dimensional design
- Experience with Spark or distributed data processing is a strong plus
- Clear written communication — you document what you build
```

### JD 3 — Engineering Manager, Cascade Robotics

> Expected picks: the *Engineering Team Lead* summary, the Brightline team
> lead role, and the Leadership & Delivery skills.

```
Engineering Manager — Cascade Robotics, Seattle, WA

Cascade Robotics is scaling its platform team from 6 to 14 engineers and
needs a hands-on leader to grow the group and keep delivery predictable.

What you'll do:
- Manage, mentor, and hire a team of 8+ engineers across two squads
- Own sprint planning, roadmapping, and quarterly OKRs in an agile
  environment
- Run stakeholder reviews and keep product, design, and engineering aligned
- Improve delivery predictability and engineering health metrics
- Stay technical: review designs, unblock hard problems, and guide
  architecture decisions

What we're looking for:
- 2+ years leading or managing software engineering teams
- Proven track record with agile ceremonies, roadmapping, and stakeholder
  communication
- Experience hiring, onboarding, and mentoring engineers
- Technical background — you've built and shipped software yourself
- Bonus: experience in robotics, IoT, or hardware-adjacent teams
```

## Why these three?

Each description emphasizes a different slice of the demo block library —
full-stack tooling, data infrastructure, and leadership. Autofill selects
from existing blocks only, so running the same "Starter" resume against all
three produces three visibly different resumes from the same content
inventory. That's the whole point of the modular builder.
