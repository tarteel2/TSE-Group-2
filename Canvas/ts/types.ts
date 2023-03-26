import { DEFAULTFILEPATHS, COLOURSLIGHT, DEFAULTIMGPATHS, createLabel } from "./config.js";

export interface ImgPaths {
    readonly rainfall: string,
    readonly sunshine: string,
    readonly lowTemp: string,
    readonly highTemp: string,
}

/**
 * Typedef for the set of required file-paths for rendered objects.
 */
export interface ObjPaths {
    readonly enContours: string,
    readonly scContours: string,
    readonly waContours: string,
    readonly niContours: string,
    readonly irContours: string
}

/**
 * Typedef for the set of offsets used on each object during rendering.
 */
export interface CtryOffsets {
    en: number[],
    sc: number[],
    wa: number[],
    ni: number[],
    ir: number[]
}

export interface ColourScheme {
    background: RGB,
    stroke: RGB,
    gradientDark: RGB,
    gradientLight: RGB,
    gradientNull: RGB,
    labelBackground: string,
    labelText: string
}



// Implementation of https://stackoverflow.com/a/5624139
// export function RGBFromHex(_hex: string): RGB | null {
//     var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(_hex);
//     return result ? {
//       r: parseInt(result[1], 16),
//       g: parseInt(result[2], 16),
//       b: parseInt(result[3], 16)
//     } : null;
// }

export class Manager {
    controller: Controller;

    constructor(_controller: Controller) {
        this.controller = _controller;
        this.controller.managerChangeCallback = this.contextChangeCallback;
    }

    contextChangeCallback(_active: string) {
        console.log(_active)
    }
}

export class Controller {
    countryList: Map<string, Country>;
    staticObjectList: Map<string, ContourObject>
    labelContainer: JQuery<HTMLElement>;
    labelList: Map<string, Label>
    lastActive: string;

    canvasHeightTranslation: number;
    canvasWidthTranslation: number;
    canvasScaleFactorX: number;
    canvasScaleFactorY: number;

    managerChangeCallback: (_active: string) => void;

    activeChangeCallback(_active: string) {
        if (_active == this.lastActive) return;
        this.lastActive = _active;
        // pass message to manager.
        this.managerChangeCallback(_active)
    }

    handleHoverAnimations(_ctry: Country) {
        let shade = 12;  

        if (_ctry.hover == true && _ctry.active == false) {
            if(_ctry.animationMap.has('hoverReverse')) {
                // shade = shade - Math.abs(_ctry.animationMap.get('hoverReverse').endAnimation());
                _ctry.animationMap.delete('hoverReverse')
            }
            // console.log(shade)
            if (!_ctry.animationMap.has('hover')) {
                let startFill = {
                    r: _ctry.rootFill.r - shade,
                    g: _ctry.rootFill.g - shade,
                    b: _ctry.rootFill.b - shade
                }
                let animation = new HoverAnimation(_ctry,'hover',255,startFill,shade)
                _ctry.animationMap.set('hover', animation);
            }
        } else {
            if(_ctry.animationMap.has('hover')) {
                shade = -_ctry.animationMap.get('hover').endAnimation();
                _ctry.animationMap.delete('hover')


                if (!_ctry.animationMap.has('hoverReverse')) {
                    let startFill = {
                        r: _ctry.rootFill.r + shade,
                        g: _ctry.rootFill.g + shade,
                        b: _ctry.rootFill.b + shade
                    }
                    let animation = new HoverAnimation(_ctry,'hoverReverse',255,startFill,shade)
                    _ctry.animationMap.set('hoverReverse', animation);
                }
            }
        }
    }

    checkLabelOwnerExists(_labelName: string): boolean {
        for (let key of this.countryList.keys()) {
            if (_labelName == key) return true;
        }
        return false;
    }

    setupLabels(_labelConfig: object): void {
        for (let config in Object.entries(_labelConfig)) {
            let info = Object.values(_labelConfig)[config]
            if (!this.checkLabelOwnerExists(info.owner)) continue;
            
            let element: JQuery<HTMLElement> = createLabel(COLOURSLIGHT)
            let country: Country = this.countryList.get(info.owner);

            element.find('#canvas-label-title').text(info.title)

            let label: Label = {
                content: element,
                offsetX: info.offset[0],
                offsetY: info.offset[1]
            }

            label.content.on('mouseenter', (e: JQuery.Event) => {
                country.hoverLock = true;
                country.hover = true;
                this.handleHoverAnimations(country)
            }) 
            
            label.content.on('mouseleave', (e: JQuery.Event) => {
                country.hoverLock = false;
            })

            label.content.on('click', (e: JQuery.Event) => {
                country.active = true;
            })

            this.labelList.set(info.owner, label)
        }
    }

    updateCanvasAttributes(_scaleFactorX: number, _scaleFactorY: number) {
        this.canvasScaleFactorX = _scaleFactorX;
        this.canvasScaleFactorY = _scaleFactorY;
    }

    positionLabels(): void {
        for (let [key, label] of this.labelList.entries()) {
            if (!this.checkLabelOwnerExists(key)) continue;

            label.content.css({
                "top": (this.labelContainer.innerHeight() * 0.7) + (label.offsetY * this.canvasScaleFactorY),
                "left": (this.labelContainer.innerWidth() * 0.65) + (label.offsetX * this.canvasScaleFactorX)
            })
        }

    }

    renderLabels() {
        this.labelContainer.empty()
        this.labelList.forEach((obj, key) => {
            obj.content.appendTo(this.labelContainer)
        })
    }

    constructor(_objects: { ctryList: Map<string, Country>, staticObjList: Map<string, ContourObject> },
        _labelContainer: JQuery<HTMLElement>,
        _canvasHeightTranslation: number,
        _canvasWidthTranslation: number,
        _canvasScaleFactorX: number,
        _canvasScaleFactorY: number
    ) {
        this.countryList = _objects.ctryList;
        this.staticObjectList = _objects.staticObjList;
        this.labelContainer = _labelContainer;
        this.lastActive = undefined;
        this.labelList = new Map();
        this.canvasHeightTranslation = _canvasHeightTranslation;
        this.canvasWidthTranslation = _canvasWidthTranslation;
        this.updateCanvasAttributes(_canvasScaleFactorX, _canvasScaleFactorY)
    }
}

type Label = {
    content: JQuery<HTMLElement>,
    offsetX: number,
    offsetY: number
}

export type RGB = {
    r: number,
    g: number,
    b: number
}

/**
 * Class for creating static shapes from contours. Contours are a set of points linked together through a line/stroke that form a full path/image.
 */
export class ContourObject {
    originContourPoints: number[][];
    contourPoints: number[][];
    rootOffsetX: number;
    rootOffsetY: number;
    rootFill: RGB;
    fill: RGB;
    stroke: RGB;

    animationMap: Map<string, any>

    /**
     * Initializing a Contour-based Object.
     * @param _pts 
     * @param _offsetX 
     * @param _offsetY 
     */
    constructor(_pts: number[][], _offsetX: number, _offsetY: number) {
        try {
            if (_pts.length <= 0) throw 404;
            this.originContourPoints = _pts;
            this.rootOffsetX = _offsetX;
            this.rootOffsetY = _offsetY;
            // Javascript Deepcopy moment.
            this.contourPoints = JSON.parse(JSON.stringify(this.originContourPoints));
            this.animationMap = new Map();
        }
        catch (error) {
            console.log(error);
        }
    }

    scalePoints(_scaleFactorX: number, _scaleFactorY: number) {
        for (let it = 0; it < this.contourPoints.length; it++) {
            this.contourPoints[it][0] = this.contourPoints[it][0] * _scaleFactorX;
            this.contourPoints[it][1] = this.contourPoints[it][1] * _scaleFactorY;
        }
    }

    positionPoints(_scaleFactorX: number, _scaleFactorY: number, _heightTranslation: number, _widthTranslation: number) {
        for (let it = 0; it < this.contourPoints.length; it++) {
            this.contourPoints[it][0] = this.contourPoints[it][0] + (this.rootOffsetX * _scaleFactorX) + (_widthTranslation);
            this.contourPoints[it][1] = this.contourPoints[it][1] + (this.rootOffsetY * _scaleFactorY) + (_heightTranslation);
        }

    }

}

export class Country extends ContourObject {
    /**
     * Stores the highest value that any coordinate reaches on a boundary. 
     * Calculated post-scaling, but are not relative to screen position.
     * Calculated each time there is a context change.
     * TopLeft-X, TopLeft-Y, BottomRight-X, BottomRight-Y
     */
    boundaryPoints: number[] = [0, 0, 0, 0];
    /**
     * Stores the contextualized values of the boundaryPoints.
     * Calculated post scaling, and point values are absolute coordinates on the canvas.
     * Calculated each time there is a context change.
     */
    detectPoints: number[] = [0, 0, 0, 0];
    hover: boolean;
    hoverLock: boolean;
    active: boolean;

    constructor(_Obj: any, _offsetX: number, _offSetY: number) {
        super(_Obj.points, _offsetX, _offSetY)
        this.hover = false;
    }

    scaleObject(_scaleFactorX: number, _scaleFactorY: number): void {
        this.contourPoints = JSON.parse(JSON.stringify(this.originContourPoints));
        this.scalePoints(_scaleFactorX, _scaleFactorY)
        this.setBoundaryPoints()
    }

    positionObject(_scaleFactorX: number, _scaleFactorY: number, _heightTranslation: number, _widthTranslation: number): void {
        this.positionPoints(_scaleFactorX, _scaleFactorY, _heightTranslation, _widthTranslation)

        this.detectPoints[0] = _widthTranslation + this.boundaryPoints[0] + (_scaleFactorX * this.rootOffsetX)
        this.detectPoints[1] = _heightTranslation + this.boundaryPoints[1] + (_scaleFactorY * this.rootOffsetY)
        this.detectPoints[2] = _widthTranslation + this.boundaryPoints[2] + (_scaleFactorX * this.rootOffsetX)
        this.detectPoints[3] = _heightTranslation + this.boundaryPoints[3] + (_scaleFactorY * this.rootOffsetY)
    }

    setBoundaryPoints(): void {
        let points: number[][] = this.contourPoints;
        for (let it = 0; it < points.length; it++) {
            if (points[it][0] < this.boundaryPoints[0]) this.boundaryPoints[0] = points[it][0]
            if (points[it][1] < this.boundaryPoints[1]) this.boundaryPoints[1] = points[it][1]
            if (points[it][0] > this.boundaryPoints[2]) this.boundaryPoints[2] = points[it][0]
            if (points[it][1] > this.boundaryPoints[3]) this.boundaryPoints[3] = points[it][1]
        }
    }


    angle2D(_x1: number, _y1: number, _x2: number, _y2: number): number {
        let dtheta, theta1, theta2;

        theta1 = Math.atan2(_y1, _x1);
        theta2 = Math.atan2(_y2, _x2);
        dtheta = theta2 - theta1;
        while (dtheta > Math.PI) {
            dtheta -= 2 * Math.PI;
        }
        while (dtheta < - Math.PI) {
            dtheta += 2 * Math.PI;
        }

        return (dtheta);
    }

    //https://www.eecs.umich.edu/courses/eecs380/HANDOUTS/PROJ2/InsidePoly.html
    // IMPLEMENTATION OF ALGORITHM 2
    detectInside(_mouse: number[]): boolean {
        if (
            ((_mouse[0] >= this.detectPoints[0]) &&
                (_mouse[0] <= this.detectPoints[2]) &&
                (_mouse[1] >= this.detectPoints[1]) &&
                (_mouse[1] <= this.detectPoints[3]) == false)
        ) { return false };

        let angle: number = 0;
        let polygon = this.contourPoints;

        for (let i = 0; i < polygon.length - 1; i++) {
            let p1: number[] = [polygon[i][0] - _mouse[0], polygon[i][1] - _mouse[1]];
            let p2: number[] = [polygon[(i + 1) % polygon.length][0] - _mouse[0], polygon[(i + 1) % polygon.length][1] - _mouse[1]];
            angle += this.angle2D(p1[0], p1[1], p2[0], p2[1]);
        }

        if (Math.abs(angle) < Math.PI) {
            return false;
        } else {
            return true;
        }
    }

    processAnimations(): void {
        this.animationMap.forEach((animation, key) => {
            animation.processAnimation()
        })
    }

}



class Animation {
    country: Country;
    name: string;
    startTime: number;
    endTime: number;
    // Duration is in 'ms'.
    duration: number;

    getFramePercentage(): number {
        let timestamp: number = Date.now();
        return ((timestamp - this.startTime) / this.duration);
    }


    processAnimation?(): void;

    constructor(_country: Country, _animationName: string, _duration: number) {
        this.country = _country;
        this.name = _animationName;
        this.startTime = Date.now()
        this.endTime = Date.now() + _duration;
        this.duration = this.endTime - this.startTime;
    }
}

export class HoverAnimation extends Animation {
    startColour: RGB;
    shadeStrength: number;

    endAnimation(): number {
        // this.country.fill = this.startColour;
        let framePercentage: number = this.getFramePercentage();
        if (framePercentage >= 1) framePercentage = 1;
        return Math.floor(this.shadeStrength * framePercentage)
    }

    processAnimation(): void {
        let framePercentage: number = this.getFramePercentage();
        if (framePercentage >= 1) { return };

        let frameShade: number = Math.floor(this.shadeStrength * framePercentage)
        this.country.fill = {
            r: this.startColour.r - frameShade,
            g: this.startColour.g - frameShade,
            b: this.startColour.b - frameShade
        }
        return;
    }

    constructor(_country: Country, _animationName: string, _duration: number, _startColour: RGB, _shadeStrength: number) {
        super(_country, _animationName, _duration);
        this.startColour = _startColour;
        this.shadeStrength = _shadeStrength;
    }
}

