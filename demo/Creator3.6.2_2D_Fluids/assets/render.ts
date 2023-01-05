
import { _decorator, Node, Renderable2D, Vec3, IAssembler, Mat4, gfx, PhysicsSystem2D, PHYSICS_2D_PTM_RATIO, UITransform, SpriteFrame, view, profiler, Collider2D, ECollider2DType, debug, BoxCollider2D, EPhysics2DDrawFlags, RigidBody2D, Vec2, RenderTexture, Camera, Sprite, sys, MeshRenderData } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, property, executeInEditMode } = _decorator;

// @ts-ignore
const b2: any = b2 || null!

const vec3_temps: Vec3[] = [];
for (let i = 0; i < 4; i++) {
    vec3_temps.push(new Vec3());
}

class WaterAssembler implements IAssembler {
    createData(com: WaterRender) {
        let vertexCount = 4;
        let indexCount = 6;

        const renderData = com.requestRenderData();
        renderData.dataLength = vertexCount;
        renderData.resize(vertexCount, indexCount);
        return renderData;
    }

    resetData(com: WaterRender) {
        let particles = com._particles;
        let particleCount = particles?.GetParticleCount();
        if (particleCount <= 0) return;

        let vertexCount = particleCount * 4;
        let indexCount = particleCount * 6;

        com.renderData.clear();
        com.renderData.dataLength = vertexCount;
        com.renderData.resize(vertexCount, indexCount);

        let material = com.renderData.material;
        com.renderData.material = material;
    }

    updateRenderData(com: WaterRender) {
        const renderData = com.renderData;
        if (renderData.vertDirty) {
            this.resetData(com);
            // renderData.updateRenderData(com, null);
        }
    }

    fillBuffers(com: WaterRender, renderer: any) {
        let particles = com._particles;
        let particleCount = particles?.GetParticleCount();
        if (particleCount <= 0) {
            return;
        }

        // Request buffer for particles
        const renderData = com.renderData.chunk;
        const floatsPerVertex = renderData.meshBuffer.floatsPerVertex;
        let vertexOffset = renderData.vertexOffset * floatsPerVertex;
        let indicesOffset = renderData.meshBuffer.indexOffset;

        let posBuff = particles.GetPositionBuffer();
        let r = particles.GetRadius() * PHYSICS_2D_PTM_RATIO * 3;

        // fill vertices
        const vbuf = renderData.meshBuffer.vData;
        for (let i = 0; i < particleCount; ++i) {
            let x = posBuff[i].x * PHYSICS_2D_PTM_RATIO;
            let y = posBuff[i].y * PHYSICS_2D_PTM_RATIO;

            // left-bottom
            vbuf[vertexOffset] = x - r;
            vbuf[vertexOffset + 1] = y - r;
            vbuf[vertexOffset + 2] = 0;
            vbuf[vertexOffset + 3] = x;
            vbuf[vertexOffset + 4] = y;
            vertexOffset += floatsPerVertex;

            // right-bottom
            vbuf[vertexOffset] = x + r;
            vbuf[vertexOffset + 1] = y - r;
            vbuf[vertexOffset + 2] = 0;
            vbuf[vertexOffset + 3] = x;
            vbuf[vertexOffset + 4] = y;
            vertexOffset += floatsPerVertex;

            // left-top
            vbuf[vertexOffset] = x - r;
            vbuf[vertexOffset + 1] = y + r;
            vbuf[vertexOffset + 2] = 0;
            vbuf[vertexOffset + 3] = x;
            vbuf[vertexOffset + 4] = y;
            vertexOffset += floatsPerVertex;

            // right-top
            vbuf[vertexOffset] = x + r;
            vbuf[vertexOffset + 1] = y + r;
            vbuf[vertexOffset + 2] = 0;
            vbuf[vertexOffset + 3] = x;
            vbuf[vertexOffset + 4] = y;
            vertexOffset += floatsPerVertex;
        }
        vertexOffset = renderData.vertexOffset

        // fill indices
        const ibuf = renderData.meshBuffer.iData;
        for (let i = 0; i < particleCount; ++i) {
            ibuf[indicesOffset++] = vertexOffset;
            ibuf[indicesOffset++] = vertexOffset + 1;
            ibuf[indicesOffset++] = vertexOffset + 2;
            ibuf[indicesOffset++] = vertexOffset + 1;
            ibuf[indicesOffset++] = vertexOffset + 3;
            ibuf[indicesOffset++] = vertexOffset + 2;
            vertexOffset += 4;
        }
        renderData.meshBuffer.indexOffset = indicesOffset;
        renderData.meshBuffer.vertexOffset = vertexOffset;
    }
};

@ccclass('WaterRender')
export class WaterRender extends Renderable2D {
    protected _assembler: IAssembler = null;

    protected _world: any = null!;
    protected _particleGroup = null;
    public _particles: any = null!;

    @property(SpriteFrame)
    fixError: SpriteFrame = null!;

    @property(BoxCollider2D)
    particleBox: BoxCollider2D = null;

    @property(Camera)
    cam: Camera = null;

    @property(Sprite)
    present: Sprite = null;

    constructor() {
        super();
    }

    onLoad() {
        // 开启物理调试
        // PhysicsSystem2D.instance.debugDrawFlags = EPhysics2DDrawFlags.Aabb |
        //     EPhysics2DDrawFlags.Pair |
        //     EPhysics2DDrawFlags.CenterOfMass |
        //     EPhysics2DDrawFlags.Joint |
        //     EPhysics2DDrawFlags.Shape;

        PhysicsSystem2D.instance.enable = true;

        if (this.cam) {
            let trans = this.present.getComponent(UITransform);

            let renderTex = new RenderTexture();
            renderTex.initialize({
                width: trans.width,
                height: trans.height
            })

            this.cam.targetTexture = renderTex;

            let sp = new SpriteFrame();
            sp.texture = renderTex;

            // 当前版本 动态创建的RT(renderTexture) 在ios、macOS平台会上下翻转
            // HACK
            if (sys.platform == sys.Platform.IOS || sys.platform == sys.Platform.MACOS) {
                sp.flipUVY = true;
            }

            this.present.spriteFrame = sp;

            // @ts-ignore
            this.present.updateMaterial();
        }
    }

    start() {
        profiler.hideStats();

        // [3]
        this._world = PhysicsSystem2D.instance;

        var psd_def = {
            strictContactCheck: false,
            density: 1.0,
            gravityScale: 1.0,
            radius: 0.35,
            maxCount: 0,
            pressureStrength: 0.005,
            dampingStrength: 1.0,
            elasticStrength: 0.25,
            springStrength: 0.25,
            viscousStrength: 0.0,
            surfaceTensionPressureStrength: 0.2,
            surfaceTensionNormalStrength: 0.2,
            repulsiveStrength: 1.0,
            powderStrength: 0.5,
            ejectionStrength: 0.5,
            staticPressureStrength: 0.2,
            staticPressureRelaxation: 0.2,
            staticPressureIterations: 8,
            colorMixingStrength: 0.5,
            destroyByAge: true,
            lifetimeGranularity: 1.0 / 60.0
        };
        psd_def.radius = 0.35;
        psd_def.viscousStrength = 0;

        // @ts-ignore
        var psd = {
            ...psd_def,
            Clone: function () {
                return psd_def;
            }
        };
        this._particles = this._world.physicsWorld.impl.CreateParticleSystem(psd);

        if (!EDITOR) {
            this.scheduleOnce(() => {
                this.GenerateWater();
            })
        }
    }

    CreateParticlesGroup() {
        // @ts-ignore
        var particleGroupDef = {
            flags: 0,
            groupFlags: 0,
            angle: 0.0,
            linearVelocity: { x: 0, y: 0 },
            angularVelocity: 0.0,
            color: { r: 0, g: 0, b: 0, a: 0 },
            strength: 1.0,
            shapeCount: 0,
            stride: 0,
            particleCount: 0,
            lifetime: 0,
            userData: null,
            group: null,
            shape: null,
            position: {
                x: this.particleBox.node.getWorldPosition().x / PHYSICS_2D_PTM_RATIO,
                y: this.particleBox.node.getWorldPosition().y / PHYSICS_2D_PTM_RATIO
            },
            // @ts-ignore
            shape: this.particleBox._shape._createShapes(1.0, 1.0)[0]
        };

        this._particleGroup = this._particles.CreateParticleGroup(particleGroupDef);
        this.SetParticles(this._particles);

        let vertsCount = this._particles.GetParticleCount();
        console.log(vertsCount);
    }

    GenerateWater() {
        if (this._particleGroup != null) {
            this._particleGroup.DestroyParticles(false);
            this._particles.DestroyParticleGroup(this._particleGroup);
            this._particleGroup = null;
        }

        this.scheduleOnce(() => {
            this.CreateParticlesGroup();
        });
    }

    public SetParticles(particles) {
        //@ts-ignore
        this._particles = particles;

        let trans = this.node.getComponent(UITransform);
        // particles.GetRadius() * PTM_RATIO 是相对于场景(世界空间)的大小
        // particles.GetRadius() * PTM_RATIO / this.node.width 是相对于纹理的大小(纹理和屏幕同宽)，范围[0, 1]
        this.customMaterial.setProperty("radius", particles.GetRadius() * PHYSICS_2D_PTM_RATIO / trans.width);
        this.customMaterial.setProperty("yratio", trans.height / trans.width);
        this.customMaterial.setProperty("reverseRes", new Vec2(1.0 / trans.width, 1.0 / trans.height));

        this.markForUpdateRenderData();
    }

    protected _render(render: any) {
        render.commitComp(this, this._renderData, this.fixError, this._assembler!);
    }

    protected _canRender() {
        return true;
    }

    protected _flushAssembler(): void {
        if (this._assembler == null) {
            this._assembler = new WaterAssembler();
            this._renderData = this._assembler.createData(this);
        }
    }
}