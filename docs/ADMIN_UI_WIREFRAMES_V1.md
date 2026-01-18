# Admin UI Wireframes v1 (Text)

Status: Draft
Updated: 2026-01-17

All screens are local-only, no auth.

## 1. Dashboard
```
+------------------------------------------------------------+
| Bible Bench Admin Dashboard                                 |
+------------------------------------------------------------+
| Runs Summary                                                |
|  - Last Run: run_2026-01-17_001 (completed)                 |
|  - Failed Items: 3                                          |
|  - Duration: 01:02:33                                       |
|                                                            |
| [Retry Failed] [View Run] [Go to ETL Control]               |
+------------------------------------------------------------+
| Alerts                                                     |
|  - MODEL-PARSE-001 (run_2026-01-17_001)                     |
|  - ETL-VERSE-001 (run_2026-01-17_002)                       |
+------------------------------------------------------------+
```

## 2. ETL Control
```
+------------------------------------------------------------+
| ETL Control                                                 |
+------------------------------------------------------------+
| Raw Ingest                                                  |
|  [Path: /abs/chapters] [Run Raw Ingest]                     |
|                                                            |
| Chapter Transform                                           |
|  [Run Chapter Transform] (auto verse transform)             |
|                                                            |
| Recent Runs                                                 |
|  - run_2026-01-17_001 RAW_INGEST completed                  |
|  - run_2026-01-17_002 CHAPTER_TRANSFORM running             |
+------------------------------------------------------------+
```

## 3. Models
```
+------------------------------------------------------------+
| Models                                                      |
+------------------------------------------------------------+
| [Add Model]                                                 |
|                                                            |
| ID  Provider  Display   Version   Active   Actions          |
| 10  OpenAI    GPT-4o    2025-12   Yes      [Edit] [Disable]|
| 11  Anthropic Claude    3.5       Yes      [Edit] [Disable]|
+------------------------------------------------------------+
```

## 4. Transform Profiles
```
+------------------------------------------------------------+
| Transform Profiles                                          |
+------------------------------------------------------------+
| [Create Profile]                                            |
|                                                            |
| ID   Name                     Scope       Active  Actions  |
| 101  ABS_KJV_CANONICAL_V1      canonical   Yes     [Edit]   |
| 201  OPENAI_KJV_OUTPUT_V1      model       Yes     [Edit]   |
+------------------------------------------------------------+
| Profile Detail                                              |
|  - Steps list with order, type, enabled                     |
|  - Reorder and toggle steps                                 |
+------------------------------------------------------------+
```

## 5. Runs
```
+------------------------------------------------------------+
| Runs                                                       |
+------------------------------------------------------------+
| Filters: [Type] [Status] [Model]                           |
|                                                            |
| runId               type            status    actions      |
| run_2026-01-17_001   MODEL_CHAPTER  completed [View]        |
| run_2026-01-17_002   MODEL_VERSE    failed    [View]        |
+------------------------------------------------------------+
| Run Detail                                                  |
|  - run items with status, attempts, last error              |
|  - [Retry Failed]                                           |
+------------------------------------------------------------+
```

## 6. Config
```
+------------------------------------------------------------+
| App Config                                                  |
+------------------------------------------------------------+
| SHOW_LATEST_ONLY: [1] [Save]                               |
+------------------------------------------------------------+
```

