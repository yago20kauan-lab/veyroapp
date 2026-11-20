"""Gera src/db/exercises-lib.json a partir do Free Exercise DB (domínio público, github.com/yuhonas/free-exercise-db).

Uso: python3 scripts/build_exercises.py /caminho/free-exercise-db/dist/exercises.json
Nomes em português: scripts/exercicios_pt.txt (índice|nome, na ordem do arquivo sem a categoria strongman).
"""
import json, re, sys, unicodedata

SRC = sys.argv[1]
OUT = 'src/db/exercises-lib.json'

# exercícios da base que já existem na biblioteca VEYRO (índice → id VEYRO): recebem fotos e o passo a passo
SAME = {39: 'supino-reto-barra', 40: 'rosca-direta', 42: 'terra', 47: 'elevacao-pelvica', 48: 'supino-inclinado-barra', 54: 'desenvolvimento-barra',
        59: 'agachamento-livre', 74: 'remada-curvada', 83: 'bike', 103: 'crucifixo-maquina', 105: 'crossover', 106: 'abdominal-polia', 199: 'paralelas',
        211: 'rosca-alternada', 212: 'supino-reto-halteres', 217: 'crucifixo-halteres', 220: 'afundo', 234: 'desenvolvimento-halteres', 235: 'encolhimento',
        257: 'face-pull', 296: 'hack', 297: 'rosca-martelo', 332: 'supino-inclinado-halteres', 400: 'cadeira-extensora', 402: 'leg-press', 437: 'mesa-flexora',
        444: 'triceps-testa', 445: 'supino-maquina', 448: 'desenvolvimento-maquina', 472: 'remada-unilateral', 528: 'prancha', 542: 'rosca-scott',
        548: 'barra-fixa', 556: 'flexao', 576: 'abdominal-infra', 582: 'crucifixo-inverso', 590: 'terra-romeno', 611: 'remada-baixa', 613: 'panturrilha-sentado',
        629: 'cadeira-flexora', 650: 'elevacao-lateral', 716: 'agachamento-bulgaro', 723: 'escada', 729: 'rosca-polia', 735: 'panturrilha-pe', 741: 'triceps-frances',
        753: 'elevacao-lateral-polia', 773: 'stiff-barra', 774: 'stiff-halteres', 778: 'pulldown-braco-reto', 798: 'abdutora', 807: 'triceps-barra-polia',
        808: 'triceps-corda', 827: 'caminhada', 840: 'puxada-frente', 824: 'puxada-triangulo', 564: 'meio-terra'}

MUSCLE = {'quadriceps': 'quadriceps', 'shoulders': 'ombros', 'abdominals': 'abdomen', 'chest': 'peito', 'hamstrings': 'posterior', 'triceps': 'triceps',
          'biceps': 'biceps', 'lats': 'costas', 'middle back': 'costas', 'calves': 'panturrilha', 'lower back': 'costas', 'forearms': 'antebraco',
          'glutes': 'gluteos', 'traps': 'trapezio', 'adductors': 'quadriceps', 'neck': 'trapezio', 'abductors': 'gluteos'}
EQUIP = {'barbell': 'barbell', 'e-z curl bar': 'barbell', 'dumbbell': 'dumbbell', 'kettlebells': 'kettlebell', 'cable': 'cable', 'machine': 'machine',
         'body only': 'bodyweight', None: 'bodyweight', 'bands': 'other', 'medicine ball': 'other', 'exercise ball': 'other', 'foam roll': 'other', 'other': 'other'}
STEP = {'barbell': (0.5, 2.5), 'dumbbell': (1, 2), 'kettlebell': (2, 4), 'machine': (1, 2.5), 'cable': (1, 2.5), 'bodyweight': (1, 0), 'other': (1, 1), 'cardio': (1, 0)}
LEVEL = {'beginner': 'iniciante', 'intermediate': 'intermediário', 'expert': 'avançado'}


def has(n, *ws):
    return any(w in n for w in ws)


def pattern(x, n):
    cat, pm = x['category'], x['primaryMuscles'][0]
    if cat == 'cardio': return 'cardio'
    if cat == 'stretching': return 'alongamento'
    if cat == 'plyometrics': return 'pliometria'
    if cat == 'olympic weightlifting': return 'olimpico'
    if has(n, 'bench press', 'floor press', 'board press', 'pin press', 'chest press', 'push-up', 'pushup', 'push up') and pm in ('chest', 'triceps', 'shoulders'):
        return 'empurrar-inc' if 'incline' in n else 'empurrar-h'
    if pm == 'chest':
        if has(n, 'fly', 'flye', 'crossover', 'cross over', 'butterfly', 'iron cross', 'squeeze'): return 'crucifixo'
        if 'pullover' in n: return 'pullover'
        return 'empurrar-inc' if 'incline' in n else 'empurrar-h'
    if pm == 'shoulders':
        if has(n, 'rear', 'reverse fl', 'face pull', 'pull apart', 'back flyes', 'reverse machine'): return 'crucifixo-inv'
        if 'upright' in n: return 'remada-alta'
        if 'rotation' in n: return 'manguito'
        if has(n, 'lateral', 'deltoid raise', 'side raise'): return 'elev-lateral'
        if has(n, 'front', 'raise', 'scaption'): return 'elev-frontal'
        if has(n, 'press', 'jerk', 'handstand'): return 'empurrar-v'
        return 'ombros'
    if pm in ('lats', 'middle back'):
        if has(n, 'pulldown', 'pull-up', 'pullup', 'pull up', 'chin', 'muscle up', 'straight-arm', 'pullover', 'rope climb'): return 'puxar-v'
        if 'shrug' in n: return 'encolhimento'
        return 'puxar-h'
    if pm == 'lower back':
        if has(n, 'deadlift', 'rack pull', 'good morning'): return 'dobrar-quadril'
        return 'lombar'
    if pm in ('quadriceps', 'adductors', 'abductors', 'glutes', 'hamstrings'):
        if pm == 'abductors' or 'abductor' in n: return 'abducao'
        if pm == 'adductors' or 'adduct' in n: return 'aducao'
        if has(n, 'leg extension'): return 'extensao-joelho'
        if has(n, 'leg curl', 'hamstring curl', 'glute ham', 'glute-ham', 'nordic'): return 'flexao-joelho'
        if has(n, 'lunge', 'split squat', 'step up', 'step-up', 'step ups'): return 'lunge'
        if has(n, 'kickback', 'glute kick'): return 'gluteo'
        if has(n, 'squat', 'leg press', 'hack'): return 'agachar'
        if pm == 'quadriceps': return 'agachar'
        return 'dobrar-quadril'
    return {'biceps': 'biceps', 'triceps': 'triceps', 'calves': 'panturrilha', 'traps': 'encolhimento', 'forearms': 'antebraco', 'neck': 'pescoco',
            'abdominals': 'core'}[pm]


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


src = [x for x in json.load(open(SRC)) if x['category'] != 'strongman']
pt = {}
for line in open('scripts/exercicios_pt.txt', encoding='utf-8'):
    i, name = line.rstrip('\n').split('|', 1)
    pt[int(i)] = name.strip()
assert len(pt) == len(src), (len(pt), len(src))

out, ids = [], set()
for i, x in enumerate(src):
    n = x['name'].lower()
    common = {'nameEn': x['name'], 'images': x['images'], 'instructionsEn': x['instructions'], 'level': LEVEL[x['level']], 'source': 'fedb'}
    if i in SAME:
        out.append({'id': SAME[i], 'patch': True, **common})
        continue
    cat = x['category']
    eq = 'cardio' if cat == 'cardio' else EQUIP[x['equipment']]
    pm = 'cardio' if cat == 'cardio' else MUSCLE[x['primaryMuscles'][0]]
    sec = [] if cat == 'cardio' else list(dict.fromkeys(MUSCLE[m] for m in x['secondaryMuscles'] if MUSCLE[m] != pm))
    if cat == 'cardio': kind = 'cardio'
    elif cat == 'stretching' or (x['force'] == 'static' and eq in ('bodyweight', 'other')): kind = 'time'
    elif eq == 'bodyweight': kind = 'bodyweight_plus'
    else: kind = 'weight'
    compound = x['mechanic'] == 'compound' or (x['mechanic'] is None and cat in ('olympic weightlifting', 'powerlifting'))
    uni = bool(re.search(r'one[- ]arm|one[- ]leg|single|alternat|unilateral|pistol|lunge|split squat|step[- ]?up', n))
    step, inc = STEP[eq]
    if kind == 'time': step, inc = 5, 0
    rest = 0 if kind == 'cardio' else 30 if cat == 'stretching' else 180 if cat == 'olympic weightlifting' else 90 if cat == 'plyometrics' else (150 if compound else 75)
    eid = 'fx-' + slug(x['id'])
    assert eid not in ids
    ids.add(eid)
    out.append({'id': eid, 'name': pt[i], 'primaryMuscle': pm, 'secondaryMuscles': sec, 'equipment': eq, 'kind': kind, 'pattern': pattern(x, n),
                'isCompound': compound, 'isUnilateral': uni, 'stepKg': step, 'incrementKg': inc, 'defaultRestSec': rest, 'category': cat, **common})

names = [o['name'] for o in out if not o.get('patch')]
dup = {k for k in names if names.count(k) > 1}
assert not dup, dup
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'registros,', sum(1 for o in out if o.get('patch')), 'atualizam exercícios existentes')
