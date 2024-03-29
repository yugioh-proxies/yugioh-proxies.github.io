(() =>
{

if (!window.jspdf)
{
    document.body.className = 'no-cdnjs';
    return;
}

if (!window.ResolvePasscode)
{
    document.body.className = 'no-asw';
    return;
}

const __elmById = ((i) => document.getElementById(i));

const BASE_CARD_WIDTH = 59;
const BASE_CARD_HEIGHT = 86;

document.body.className = 'main';

const SAMPLE_PASSCODE = '46986414';
const _GetArtworkTemplate = ((fn, passcode) =>
{
    const artwork = new Image();
    const obj = {
        isReady: false,
        artwork,
    };
    obj.ready = (async () =>
    {
        const url = await fn(passcode);
        artwork.src = url;
        await artwork.decode();
        obj.isReady = true;
        return artwork;
    })();
    return obj;
});
const _artworkFn = ((fn) =>
{
    const cache = {};
    const wrapper = ((p) => (cache[p] || (cache[p] = _GetArtworkTemplate(fn, p))));
    // preload
    wrapper(SAMPLE_PASSCODE)
    return wrapper;
});
const _artworkYGOPD = _artworkFn(async (passcode) =>
{
    return new URL('https://images.ygoprodeck.com/images/cards/'+(+passcode)+'.jpg');
});

const _artworkNeuron = _artworkFn(async (passcode) =>
{
    const {cardId, artId} = await window.ResolvePasscode(passcode);
    await window.ArtworksReady;
    return window.GetArtworkURL(cardId, artId);
});
const _artworkEDO = _artworkFn(async (passcode) =>
{
    return new URL('https://pics.projectignis.org:2096/pics/'+(+passcode)+'.jpg');
});
const FALLBACK_ARTWORK = _GetArtworkTemplate(()=>Promise.resolve('/img/no_artwork.png'), 0);
const _artworkFallback = (() => FALLBACK_ARTWORK);

const GetArtwork = ((passcode, preferredFn) => {
    const obj = {
        isReady: false
    };
    obj.ready = (async () =>
    {
        for (const tryFn of [preferredFn, _artworkYGOPD, _artworkNeuron, _artworkEDO, _artworkFallback]) {
            const nextArtwork = tryFn(passcode);
            if (!nextArtwork.isReady) try { await nextArtwork.ready; } catch(e) {}
            if (!nextArtwork.isReady) continue;
            obj.artwork = nextArtwork.artwork;
            obj.isReady = true;
            return obj.artwork;
        }
    })();
    return obj;
});

const DEFAULT_FORMATS = {
    'a4':     { format: 'a4',     pageSize: [210,297] },
    'letter': { format: 'letter', pageSize: [215.9, 279.4]},
};

const DEFAULT_PRINT_MARGINS = { left: 10, right: 10, top: 10, bottom: 10 };

const _howManyFit = ((space, each, gap) => Math.floor((space+gap)/(each+gap)));
const _fitThisMany = ((space, gap, n) => (((space+gap)/n)-gap));
const ValidateInputAndGenerateParameters = (() =>
{
    const passcodes = [];
    for (const elm of __elmById('decks-container').children)
    {
        const p = elm.passcodes;
        if (!p) continue;
        passcodes.push(...(p.filter(({enabled}) => enabled).map(({passcode}) => passcode)));
    }

    let format, pageWidth, pageHeight;
    const paperFormatValue = document.querySelector('input[name="paper-format"]:checked').value;
    if (paperFormatValue === 'custom')
    {
        // todo
    }
    else
    {
        ({format, pageSize: [pageWidth, pageHeight]} = DEFAULT_FORMATS[paperFormatValue]);
    }
    
    let cardSize;
    if (__elmById('lock-aspect-ratio').checked)
    {
        const relativeSize = .01*+__elmById('card-size-percent').value;
        cardSize = [(BASE_CARD_WIDTH * relativeSize), (BASE_CARD_HEIGHT * relativeSize)];
        __elmById('card-width').value = cardSize[0].toFixed(2);
        __elmById('card-height').value = cardSize[1].toFixed(2);
    }
    else
    {
        cardSize = [+__elmById('card-width').value, +__elmById('card-height').value];
        __elmById('card-size-percent').value = (((cardSize[0]/BASE_CARD_WIDTH)*100)-0.005).toFixed(2);
    }
    const [cardWidth, cardHeight] = cardSize;
    const cardAspectRatio = cardSize[0]/cardSize[1];
    if ((cardAspectRatio < .65) || (cardAspectRatio > .7))
        console.warn('Strange aspect ratio',cardAspectRatio,'image will be noticeably squished');
    
    let printMargins = DEFAULT_PRINT_MARGINS;
    if (document.querySelector('input[name="print-margins"]:checked').value !== 'default')
    {
        // todo
    }
    
    // todo sanity check margins
    
    const gap = [+__elmById('gap-width').value,+__elmById('gap-height').value];
    
    const printableWidth = pageWidth - (printMargins.left + printMargins.right);
    const printableHeight = pageHeight - (printMargins.top + printMargins.bottom);
    
    const cardsPerRowPortrait = _howManyFit(printableWidth, cardWidth, gap[0]);
    const rowsPerPagePortrait = _howManyFit(printableHeight, cardHeight, gap[1]);
    const cardsPerRowLandscape = _howManyFit(printableHeight, cardWidth, gap[0]);
    const rowsPerPageLandscape = _howManyFit(printableWidth, cardHeight, gap[1]);
    
    const cardsPerPagePortrait = cardsPerRowPortrait * rowsPerPagePortrait;
    const cardsPerPageLandscape = cardsPerRowLandscape * rowsPerPageLandscape;
    
    let orientation;
    switch (document.querySelector('input[name="orientation"]:checked').value)
    {
        case 'portrait':
            orientation = 'portrait';
            if (cardsPerPagePortrait < cardsPerPageLandscape)
                console.warn('Forcing portrait mode, losing paper - could be',cardsPerPageLandscape,'but is only',cardsPerPagePortrait);
            break;
        case 'landscape':
            orientation = 'landscape';
            if (cardsPerPageLandscape < cardsPerPagePortrait)
                console.warn('Forcing landscape mode, losing paper - could be',cardsPerPagePortrait,'but is only',cardsPerPageLandscape);
            break;
        default:
            if (cardsPerPageLandscape < cardsPerPagePortrait)
                orientation = 'portrait';
            else
                orientation = 'landscape';
    }
    const isLandscape = (orientation === 'landscape');
    const cardsPerRow = isLandscape ? cardsPerRowLandscape : cardsPerRowPortrait;
    const rowsPerPage = isLandscape ? rowsPerPageLandscape : rowsPerPagePortrait;
    
    if (!cardsPerRow || !rowsPerPage)
    {
        console.warn('Card size exceeds printable size, nothing will be printed');
    }
    
    const pageSize = [pageWidth, pageHeight];
    
    const printedWidth = cardsPerRow*(cardWidth+gap[0])-gap[0];
    const printedHeight = rowsPerPage*(cardHeight+gap[1])-gap[1];
    const start = [
        (isLandscape ? printMargins.top : printMargins.left) + ((isLandscape ? printableHeight : printableWidth)-printedWidth)/2,
        (isLandscape ? printMargins.right : printMargins.top) + ((isLandscape ? printableWidth : printableHeight)-printedHeight)/2
    ];
    
    let artworkFn;
    switch (document.querySelector('input[name="artwork-source"]:checked').value) {
        case 'neuron': artworkFn = _artworkNeuron; break;
        case 'edopro': artworkFn = _artworkEDO; break;
        default:       artworkFn = _artworkYGOPD; break;
    }
    
    return {
        passcodes,
        orientation,
        format,
        pageSize,
        printOffsetsRotated: (isLandscape ? [printMargins.top, printMargins.right] : [printMargins.left, printMargins.top]),
        printableSize: [ printableWidth, printableHeight ],
        
        cardSize,
        cardsPerRow,
        rowsPerPage,
        
        start,
        gap,
        
        artworkFn
    };
});

const _cardback = (async () => { const i = new Image(); i.src = 'img/card_back.png'; await i.decode(); return i; })();
const VisualizeOutputParameters = ((params) =>
{
    if (!params)
    {
        __elmById('count-cards').innerText = __elmById('count-cards2').innerText = '?';
        __elmById('cards-per-page').innerText = __elmById('cards-per-page2').innerText = '?';
        __elmById('pages-to-print').innerText = __elmById('pages-to-print2').innerText = '?';
        __elmById('make-pdf').disabled = true;
        return;
    }
    
    const cardsPerPage = (params.cardsPerRow * params.rowsPerPage);
    
    const cardCount = params.passcodes.length;
    __elmById('count-cards').innerText = __elmById('count-cards2').innerText = cardCount;
    __elmById('cards-per-page').innerText = __elmById('cards-per-page2').innerText = cardsPerPage;
    
    if (!cardsPerPage)
    {
        __elmById('pages-to-print').innerText = __elmById('pages-to-print2').innerText = '\u221E';
        __elmById('make-pdf').disabled = true;
        return;
    }
    
    const pageCount = Math.ceil(cardCount / cardsPerPage);
    __elmById('pages-to-print').innerText = __elmById('pages-to-print2').innerText = pageCount;
    __elmById('make-pdf').disabled = !cardCount;
    
    const tok = {};
    const cardPreviewCanvas = __elmById('card-preview');
    cardPreviewCanvas.tok = tok;
    (async () =>
    {
        const PX_PER_MM = 13;
        // sleeves are 62 by 89 mm
        // cards are 59 by 86 mm
        const cardBack = await _cardback;
        let sampleArt;
        if (0 < params.passcodes.length)
            sampleArt = GetArtwork(params.passcodes[0], params.artworkFn);
        
        if (sampleArt && sampleArt.isReady)
            sampleArt = sampleArt.artwork;
        else
            sampleArt = await GetArtwork(SAMPLE_PASSCODE, params.artworkFn).ready;
        
        if (cardPreviewCanvas.tok !== tok) return;
        const ctx = cardPreviewCanvas.getContext('2d');
        ctx.fillStyle = 'rgba(39, 68, 63, 1)';
        ctx.fillRect(0, 0, PX_PER_MM * 62, PX_PER_MM * 89);
        ctx.drawImage(cardBack, PX_PER_MM * 1.5, PX_PER_MM * 1.5, PX_PER_MM * 59, PX_PER_MM * 86);
        
        const [proxyWidth, proxyHeight] = params.cardSize;
        const offX = (62 - proxyWidth) / 2;
        const offY = (89 - proxyHeight) / 2;
        ctx.drawImage(sampleArt, PX_PER_MM * offX, PX_PER_MM * offY, PX_PER_MM * proxyWidth, PX_PER_MM * proxyHeight);
        
        /* give it a matte sleeve-like look */
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(0, 0, PX_PER_MM * 62, PX_PER_MM * 89);
    })();
    
    const pagePreviewCanvas = __elmById('page-preview');
    pagePreviewCanvas.tok = tok;
    (async () =>
    {
        const defaultSampleArt = await GetArtwork(SAMPLE_PASSCODE, params.artworkFn).ready;
        if (pagePreviewCanvas.tok !== tok) return;
        const ctx = pagePreviewCanvas.getContext('2d');
        ctx.clearRect(0, 0, pagePreviewCanvas.width, pagePreviewCanvas.height);
        const isLandscape = (params.orientation === 'landscape');
        const rotatedPageWidth = params.pageSize[isLandscape ? 1 : 0];
        const rotatedPageHeight = params.pageSize[isLandscape ? 0 : 1];
        const PX_PER_MM = Math.min(pagePreviewCanvas.width / rotatedPageWidth, pagePreviewCanvas.height / rotatedPageHeight);
        const drawLeft = (pagePreviewCanvas.width-(rotatedPageWidth*PX_PER_MM))/2;
        const drawTop = (pagePreviewCanvas.height-(rotatedPageHeight*PX_PER_MM))/2;
        
        ctx.fillStyle = '#fcc';
        ctx.fillRect(drawLeft, drawTop, rotatedPageWidth * PX_PER_MM, rotatedPageHeight * PX_PER_MM);
        ctx.fillStyle = 'white';
        ctx.fillRect(
            drawLeft + params.printOffsetsRotated[0]*PX_PER_MM,
            drawTop + params.printOffsetsRotated[1]*PX_PER_MM,
            params.printableSize[isLandscape ? 1 : 0]*PX_PER_MM,
            params.printableSize[isLandscape ? 0 : 1]*PX_PER_MM
        );
        for (let x=0; x<params.cardsPerRow; ++x) for (let y=0; y<params.rowsPerPage; ++y)
        {
            const idx = x+y*params.cardsPerRow;
            if (params.passcodes.length && (params.passcodes.length <= idx)) continue;
            
            let sampleArt = (idx < params.passcodes.length) && GetArtwork(params.passcodes[idx], params.artworkFn);
            if (sampleArt && sampleArt.isReady)
                sampleArt = sampleArt.artwork;
            else
                sampleArt = defaultSampleArt;
            
            const left = drawLeft + (params.start[0] + x*(params.cardSize[0]+params.gap[0]))*PX_PER_MM;
            const top = drawTop + (params.start[1] + y*(params.cardSize[1]+params.gap[1]))*PX_PER_MM;
            ctx.drawImage(sampleArt, left, top, PX_PER_MM * params.cardSize[0], PX_PER_MM * params.cardSize[1]);
        }
    })();
});

const GeneratePDFFromParameters = (async (params) =>
{
    const pdf = new jspdf.jsPDF({
        orientation: params.orientation,
        format: (params.format || params.pageSize),
        unit: 'mm',
        putOnlyUsedFonts: true,
    });
    
    const {cardsPerRow, rowsPerPage} = params;
    const cardsPerPage = cardsPerRow * rowsPerPage;
    for (let i=1; i<Math.ceil(params.passcodes.length / cardsPerPage); ++i)
        pdf.addPage({format: (params.format || params.pageSize), orientation: params.orientation});
    
    const _coord = ((col,row) => [params.start[0] + col*(params.cardSize[0]+params.gap[0]), params.start[1] + row*(params.cardSize[1]+params.gap[1])]);
    const _place = ((i) => ({ page: Math.floor(i/cardsPerPage), coords: _coord(i%cardsPerRow,Math.floor((i%cardsPerPage)/cardsPerRow)) }));
    
    await Promise.all(params.passcodes.map(async (p,i) =>
    {
        const artwork = await GetArtwork(p, params.artworkFn).ready;
        const {page, coords: [x,y]} = _place(i);
        pdf.setPage(page+1);
        pdf.addImage(artwork, 'png', x, y, params.cardSize[0], params.cardSize[1]);
    }));
    
    const result = pdf.output('blob', 'proxies.pdf');
    const resultURL = URL.createObjectURL(result);
    
    const aElm = document.createElement('a');
    aElm.href = resultURL;
    aElm.download = 'proxies.pdf';
    aElm.click();
    
    window.setTimeout(() => { URL.revokeObjectURL(result); }, 5000);
});

let _currentGenerationParameters = null;
const ProcessInputUpdateOutput = (() =>
{
    try
    {
        _currentGenerationParameters = ValidateInputAndGenerateParameters();
    } catch (e) {
        // todo
        console.error(e);
    }
    
    try
    {
        VisualizeOutputParameters(_currentGenerationParameters);
    } catch (e) {
        // todo
        console.error(e);
    }
});

window.setInterval(ProcessInputUpdateOutput, 1000);
ProcessInputUpdateOutput();

for (const elm of __elmById('input-box').getElementsByTagName('select'))
    elm.addEventListener('input', ProcessInputUpdateOutput);

for (const elm of __elmById('input-box').getElementsByTagName('input'))
    elm.addEventListener('change', ProcessInputUpdateOutput);

const _relativeSizeListCache = {};
const GetOptimalRelativeSizes = ((arr) =>
{
    const key = JSON.stringify(arr);
    const cached = _relativeSizeListCache[key];
    if (cached) return cached;
    
    const [portraitPrintableWidth, portraitPrintableHeight, gapX, gapY] = arr;
    
    const optima = {};
    for (const [k, printableWidth, printableHeight] of [['portrait', portraitPrintableWidth, portraitPrintableHeight], ['landscape', portraitPrintableHeight, portraitPrintableWidth]])
    {
        const dedup = {'1':true};
        const queue = [1];
        while (queue.length)
        {
            const relativeSize = queue.pop();
            const nX = _howManyFit(printableWidth, BASE_CARD_WIDTH*relativeSize, gapX);
            const nY = _howManyFit(printableHeight, BASE_CARD_HEIGHT*relativeSize, gapY);
            const n = (nX*nY);
            const target = (optima[n] || (optima[n] = {}));
            
            const szPct = relativeSize*100;
            if ((target[k] || 0) < szPct)
            {
                target[k] = szPct;
                if ((target.auto || 0) < szPct)
                    target.auto = szPct;
            }
            
            const newSizeX = Math.floor(_fitThisMany(printableWidth, gapX, nX+1)/BASE_CARD_WIDTH*10000)/10000;
            const newSizeY = Math.floor(_fitThisMany(printableHeight, gapY, nY+1)/BASE_CARD_HEIGHT*10000)/10000;
            if ((newSizeX >= .25) && !dedup[newSizeX])
            {
                queue.push(newSizeX);
                dedup[newSizeX] = true;
            }
            if ((newSizeY >= .25) && !dedup[newSizeY])
            {
                queue.push(newSizeY);
                dedup[newSizeY] = true;
            }
        }
    }
    
    const sortedOptima = Object.entries(optima).sort((a,b) => (b[0]-a[0]));
    
    const result = {}
    for (const k of ['auto','portrait','landscape'])
    {
        result[k] = [];
        let last = 0;
        // n are strictly descending, relative sizes should be getting bigger
        for (const [n, obj] of sortedOptima)
        {
            const d = obj[k];
            if (!d || ((d-0.5) <= last)) continue;
            last = d;
            result[k].push(d);
        }
    }
    
    _relativeSizeListCache[key] = result;
    return result;
});
let _cardSizeStep; _cardSizeStep = ((reduce) =>
{
    const params = ValidateInputAndGenerateParameters();
    const orientationSetting = document.querySelector('input[name="orientation"]:checked').value;
    const sortedOptima = GetOptimalRelativeSizes([...params.printableSize, ...params.gap])[orientationSetting];
    
    const currentSize = +__elmById('card-size-percent').value;
    if (reduce)
    {
        let last;
        for (const size of sortedOptima)
            if ((size-currentSize) < -0.2)
                last = size;
            else
                return isFinite(last) && (last-0.005).toFixed(2);
    }
    else
    {
        for (const size of sortedOptima)
            if ((size-currentSize) > 0.2)
                return (size-0.005).toFixed(2);
    }
});
__elmById('reduce-card-size').addEventListener('click', () =>
{
    const result = _cardSizeStep(true);
    if (!result) return;
    __elmById('card-size-percent').value = result;
    ProcessInputUpdateOutput();
});
__elmById('increase-card-size').addEventListener('click', () =>
{
    const result = _cardSizeStep(false);
    if (!result) return;
    __elmById('card-size-percent').value = result;
    ProcessInputUpdateOutput();
});

__elmById('decks-container').addEventListener('click', function(e)
{
    if (e.target.closest('.entry'))
        return;
    if (!this.children.length)
        __elmById('decklist').click();
});

const _updateCardsText = ((entry) =>
{
    const nEnabled = entry.passcodes.reduce((a, {enabled}) => a + enabled, 0);
    const nTotal = entry.passcodes.length;
    entry.statusText.innerText = (nEnabled+'/'+nTotal+' selected')
});

const _newDecklistEntry = ((deckName) =>
{
    const parent = __elmById('decks-container');
    const entry = document.createElement('div');
    entry.style.backgroundColor = ('hsl('+(180+parent.children.length*74)+'deg, 100%, 75%)');
    entry.className = 'entry loading';
    const cards = document.createElement('span');
    cards.className = 'status';
    cards.innerText = 'Loading\u2026';
    entry.statusText = cards;
    const name = document.createElement('span');
    name.className = 'name';
    name.innerText = deckName;
    const del = document.createElement('span');
    del.className = 'delete';
    del.innerText = '\uD83D\uDDD1\uFE0E';
    del.addEventListener('click', () => { parent.removeChild(entry); if (!parent.children.length) try { window.history.replaceState(undefined, undefined, '/'); } catch(e) {} });
    entry.appendChild(name);
    entry.appendChild(cards);
    entry.appendChild(del);
    parent.appendChild(entry);
    
    entry.addEventListener('click', (e) => 
    {
        if (e.target.classList.contains('delete'))
            return;
        if (entry.classList.contains('loading'))
        {
            entry.delayedOpen = true;
            return;
        }
        
        document.body.classList.add('deck-select');
        
        const container = __elmById('deck-select-ctr');
        while (container.lastElementChild)
            container.removeChild(container.lastElementChild);
        
        for (const obj of entry.passcodes)
        {
            const box = document.createElement('div');
            const img = document.createElement('img');
            box.className = 'card-proxy';
            Promise.any([_artworkYGOPD(obj.passcode).ready, _artworkNeuron(obj.passcode).ready]).then((a) => { img.src = a.src; });
            if (!obj.enabled)
                box.classList.add('disabled');
            box.addEventListener('click', () =>
            {
                obj.enabled = !obj.enabled;
                box.classList.toggle('disabled', !obj.enabled);
                _updateCardsText(entry);
                ProcessInputUpdateOutput();
            });
            
            box.appendChild(img);
            container.appendChild(box);
        }
    });
    
    return entry;
});

const _decklistInput = __elmById('decklist');
_decklistInput.addEventListener('change', () =>
{
    const file = _decklistInput.files[0];
    if (!file) return;
    _decklistInput.value = '';
    
    const entry = _newDecklistEntry(file.name);
    
    file.text().then((t) =>
    {
        entry.classList.remove('loading');
        entry.passcodes = t.split('\n').map((t) => parseInt(t.trim())).filter(isFinite).map((passcode) => ({ passcode, enabled: true }));
        _updateCardsText(entry);
        ProcessInputUpdateOutput();
        if (entry.delayedOpen)
            entry.click();
    });
});

const _consumeFragment = (() =>
{
    const fragment = document.location.hash;
    if (!fragment)
        return;
    
    for (const deck of fragment.substring(1).split(';'))
    {
        try
        {
            if (!deck)
                continue;
            const parts = deck.split(',');
            if (parts.length !== 3)
                continue;
            if (parts[1].toLowerCase() !== 'ydke')
                continue;
            const deckName = decodeURIComponent(parts[0]);
            
            const ydkeData = parts[2];
            const passcodes = [];
            for (const deckData of ydkeData.split('!').map(atob))
            {
                const n = deckData.length;
                if ((n % 4) !== 0)
                    throw ('Invalid YDKe deck data (length not multiple of 4, length = '+n+')');
                for (let i=0; i<n; i += 4)
                {
                    passcodes.push({
                        passcode: (
                            (deckData.charCodeAt(i+0) <<  0) |
                            (deckData.charCodeAt(i+1) <<  8) |
                            (deckData.charCodeAt(i+2) << 16) |
                            (deckData.charCodeAt(i+3) << 24)),
                        enabled: true,
                    });
                }
            }
            
            const entry = _newDecklistEntry(deckName);
            entry.classList.remove('loading');
            entry.passcodes = passcodes;
            _updateCardsText(entry);
            if (entry.delayedOpen)
                entry.click();
        } catch (e) {
            console.warn('Failed to load deck', deck, e);
        }
    }
    
    ProcessInputUpdateOutput();
});

window.addEventListener('hashchange', _consumeFragment);
_consumeFragment();

const _toggleDeckSelectIf = ((pred) => { for (const elm of __elmById('deck-select-ctr').children) if (pred(elm)) elm.click(); });
__elmById('deck-select-all').addEventListener('click', () => { _toggleDeckSelectIf((e) => e.classList.contains('disabled')); });
__elmById('deck-select-none').addEventListener('click', () => { _toggleDeckSelectIf((e) => !e.classList.contains('disabled')); });
__elmById('deck-select-invert').addEventListener('click', () => { _toggleDeckSelectIf(()=>true); });

__elmById('deck-select-overlay-bg').addEventListener('click', () => { document.body.classList.remove('deck-select'); });
document.addEventListener('keyup', (e) => { if (e.key === 'Escape') document.body.classList.remove('deck-select'); });
__elmById('make-pdf').addEventListener('click', () => { GeneratePDFFromParameters(_currentGenerationParameters); });

})();
